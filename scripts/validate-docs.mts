#!/usr/bin/env tsx
/**
 * DevNet StudyLab -- Documentation Validation Script
 *
 * Validates that all API routes, page routes, and database tables in the
 * codebase have corresponding documentation in the docs/ directory.
 *
 * Checks:
 *   1. Every API route file (app/api/<...>/route.ts) is documented in API_REFERENCE.md
 *   2. Every page route (app/<...>/page.tsx) is documented in ROUTES.md
 *   3. Every database table (from schema.ts) is documented in DATABASE_SCHEMA.md
 *   4. Every Python mock/engine endpoint is documented in API_REFERENCE.md
 *   5. Reports stale doc entries that reference routes/tables no longer in code
 *
 * Exit codes:
 *   0 -- All documentation is current
 *   1 -- Gaps or stale entries found
 *
 * Usage:
 *   npx tsx scripts/validate-docs.ts
 *   npx tsx scripts/validate-docs.ts --json   # Output results as JSON
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const WEB_APP_SRC = path.join(PROJECT_ROOT, "apps", "web", "src");
const SERVICES_DIR = path.join(PROJECT_ROOT, "services");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

/**
 * Next.js encodes dynamic segments as `[slug]` / `[...rest]`, while the docs
 * write them as `{slug}`. Normalize both sides to the brace form before
 * comparing, otherwise every dynamic route reads as undocumented.
 */
function normalizeRoute(route: string): string {
  return route
    .replace(/\[\.\.\.([^\]]+)\]/g, "{$1}")
    .replace(/\[([^\]]+)\]/g, "{$1}");
}

/**
 * Reduce a route to its URL *shape* by blanking dynamic segment names, so a
 * path is matched on structure rather than on what the parameter happens to be
 * called. The name is not part of the contract: FastAPI declares
 * `/networks/{network_id}/devices` while the docs, following Cisco's own
 * reference, write `/networks/{networkId}/devices` - the same endpoint.
 */
function routeShape(route: string): string {
  return normalizeRoute(route).replace(/\{[^}]*\}/g, "{}");
}

/** Escape regex metacharacters so a route can be embedded in a pattern. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const API_REFERENCE_FILE = path.join(DOCS_DIR, "API_REFERENCE.md");
const ROUTES_FILE = path.join(DOCS_DIR, "ROUTES.md");
const DATABASE_SCHEMA_FILE = path.join(DOCS_DIR, "DATABASE_SCHEMA.md");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  category: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: string;
}

interface ValidationReport {
  timestamp: string;
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: ValidationResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively find files matching a predicate.
 */
function findFiles(
  dir: string,
  predicate: (filePath: string) => boolean,
  results: string[] = []
): string[] {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      findFiles(fullPath, predicate, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Derive the URL path from a file system path following Next.js App Router conventions.
 */
function filePathToRoute(filePath: string, appDir: string): string {
  let relative = path.relative(appDir, filePath);
  relative = path.dirname(relative);
  let route = "/" + relative.split(path.sep).join("/");
  if (route === "/.") route = "/";
  return route;
}

/**
 * Read a file and return its contents, or null if it doesn't exist.
 */
function readFileOrNull(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Extract table names from the Drizzle schema file.
 */
function extractTableNames(schemaPath: string): string[] {
  const content = readFileOrNull(schemaPath);
  if (!content) return [];

  const tables: string[] = [];
  const tableRegex = /pgTable\(\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

/**
 * Extract Python route paths from a FastAPI file.
 */
function extractPythonRoutes(
  filePath: string
): Array<{ method: string; path: string }> {
  const content = readFileOrNull(filePath);
  if (!content) return [];

  const routes: Array<{ method: string; path: string }> = [];
  const routeRegex =
    /@(?:router|app)\.(get|post|put|patch|delete)\(\s*"([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
    });
  }
  return routes;
}

/**
 * Extract HTTP methods exported from a Next.js route.ts file.
 */
function extractMethods(filePath: string): string[] {
  const content = readFileOrNull(filePath);
  if (!content) return [];

  const methods: string[] = [];
  const methodNames = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  for (const method of methodNames) {
    const pattern = new RegExp(
      `export\\s+(?:async\\s+)?(?:function|const)\\s+${method}\\b`
    );
    if (pattern.test(content)) {
      methods.push(method);
    }
  }
  return methods;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/**
 * Validate that all Next.js API routes are documented in API_REFERENCE.md.
 */
function validateApiRoutes(): ValidationResult[] {
  const results: ValidationResult[] = [];
  const appDir = path.join(WEB_APP_SRC, "app");

  // Find all route.ts files
  const routeFiles = findFiles(appDir, (f) =>
    f.endsWith("route.ts") || f.endsWith("route.js")
  );

  // Read API_REFERENCE.md
  const apiRefContent = readFileOrNull(API_REFERENCE_FILE);
  if (!apiRefContent) {
    results.push({
      category: "API Routes",
      status: "fail",
      message: "API_REFERENCE.md not found",
      details: `Expected at: ${path.relative(PROJECT_ROOT, API_REFERENCE_FILE)}`,
    });
    return results;
  }

  // Check each route file
  for (const file of routeFiles) {
    const route = filePathToRoute(file, appDir);
    const methods = extractMethods(file);
    const relativeFile = path.relative(PROJECT_ROOT, file);

    // The docs write dynamic segments either way - `/api/labs/{slug}` or the
    // literal `/api/auth/[...nextauth]` - so accept both forms.
    const normalized = normalizeRoute(route);
    const docRoute = apiRefContent.includes(route) ? route : normalized;
    const routeDocumented =
      apiRefContent.includes(route) || apiRefContent.includes(normalized);

    if (!routeDocumented) {
      results.push({
        category: "API Routes",
        status: "fail",
        message: `Route ${route} is not documented`,
        details: `File: ${relativeFile} | Methods: ${methods.join(", ")}`,
      });
    } else {
      // Check that each exported method is documented
      for (const method of methods) {
        const routePattern = escapeRegex(docRoute);
        const methodPattern = new RegExp(`${method}\\s+${routePattern}`, "i");
        const headerPattern = new RegExp(
          `###\\s+${method}\\s+${routePattern}`,
          "i"
        );
        if (!methodPattern.test(apiRefContent) && !headerPattern.test(apiRefContent)) {
          results.push({
            category: "API Routes",
            status: "warning",
            message: `Method ${method} for ${route} may not be documented`,
            details: `File: ${relativeFile}`,
          });
        }
      }

      results.push({
        category: "API Routes",
        status: "pass",
        message: `Route ${route} is documented`,
        details: `Methods: ${methods.join(", ")}`,
      });
    }
  }

  if (routeFiles.length === 0) {
    results.push({
      category: "API Routes",
      status: "warning",
      message: "No API route files found in the codebase",
    });
  }

  return results;
}

/**
 * Validate that all page routes are documented in ROUTES.md.
 */
function validatePageRoutes(): ValidationResult[] {
  const results: ValidationResult[] = [];
  const appDir = path.join(WEB_APP_SRC, "app");

  // Find all page.tsx files
  const pageFiles = findFiles(appDir, (f) =>
    f.endsWith("page.tsx") || f.endsWith("page.jsx") || f.endsWith("page.ts")
  );

  // Read ROUTES.md
  const routesContent = readFileOrNull(ROUTES_FILE);
  if (!routesContent) {
    results.push({
      category: "Page Routes",
      status: "fail",
      message: "ROUTES.md not found",
      details: `Expected at: ${path.relative(PROJECT_ROOT, ROUTES_FILE)}`,
    });
    return results;
  }

  // Check each page file
  for (const file of pageFiles) {
    const route = filePathToRoute(file, appDir);
    const relativeFile = path.relative(PROJECT_ROOT, file);

    // Check if the route appears in the doc
    // Look for the route in markdown headers, table rows, or code blocks
    const routeEscaped = route.replace(/\//g, "\\/");
    const inHeader = new RegExp(`##.*${routeEscaped === "\\/" ? "Root \\(/" : routeEscaped}`, "i").test(routesContent);
    const inTable = routesContent.includes(`| \`${route}\` `) || routesContent.includes(`| \`${route}\`|`);
    const inText = routesContent.includes(route);

    if (!inHeader && !inTable && !inText) {
      results.push({
        category: "Page Routes",
        status: "fail",
        message: `Page route ${route} is not documented`,
        details: `File: ${relativeFile}`,
      });
    } else {
      results.push({
        category: "Page Routes",
        status: "pass",
        message: `Page route ${route} is documented`,
        details: `File: ${relativeFile}`,
      });
    }
  }

  if (pageFiles.length === 0) {
    results.push({
      category: "Page Routes",
      status: "warning",
      message: "No page route files found in the codebase",
    });
  }

  // Check for stale entries in ROUTES.md
  // Extract routes from the Route Overview table
  const routeTableRegex = /\|\s*`([^`]+)`\s*\|/g;
  let tableMatch: RegExpExecArray | null;
  const documentedRoutes: string[] = [];
  while ((tableMatch = routeTableRegex.exec(routesContent)) !== null) {
    const docRoute = tableMatch[1];
    // Only check routes that look like URL paths
    if (docRoute.startsWith("/") && !docRoute.startsWith("/api")) {
      documentedRoutes.push(docRoute);
    }
  }

  const codeRoutes = pageFiles.map((f) => filePathToRoute(f, appDir));
  for (const docRoute of documentedRoutes) {
    if (!codeRoutes.includes(docRoute)) {
      results.push({
        category: "Page Routes",
        status: "warning",
        message: `Documented route ${docRoute} may be stale (not found in codebase)`,
        details: "Check if the route was removed or renamed",
      });
    }
  }

  return results;
}

/**
 * Validate that all database tables are documented in DATABASE_SCHEMA.md.
 */
function validateDatabaseSchema(): ValidationResult[] {
  const results: ValidationResult[] = [];
  const schemaPath = path.join(WEB_APP_SRC, "lib", "db", "schema.ts");

  // Extract table names from schema
  const tableNames = extractTableNames(schemaPath);

  if (tableNames.length === 0) {
    results.push({
      category: "Database Schema",
      status: "warning",
      message: "No tables found in schema.ts",
      details: `Checked: ${path.relative(PROJECT_ROOT, schemaPath)}`,
    });
    return results;
  }

  // Read DATABASE_SCHEMA.md
  const schemaDocContent = readFileOrNull(DATABASE_SCHEMA_FILE);
  if (!schemaDocContent) {
    results.push({
      category: "Database Schema",
      status: "fail",
      message: "DATABASE_SCHEMA.md not found",
      details: `Expected at: ${path.relative(PROJECT_ROOT, DATABASE_SCHEMA_FILE)}`,
    });
    return results;
  }

  // Check each table
  for (const tableName of tableNames) {
    // Look for the table name in headers, backtick references, or table rows
    const inHeader = new RegExp(`###?\\s+.*${tableName}`, "i").test(schemaDocContent);
    const inBackticks = schemaDocContent.includes(`\`${tableName}\``);
    const inCreateTable = schemaDocContent.includes(`CREATE TABLE`) && schemaDocContent.includes(tableName);

    if (!inHeader && !inBackticks && !inCreateTable) {
      results.push({
        category: "Database Schema",
        status: "fail",
        message: `Table "${tableName}" is not documented`,
        details: "Add table documentation to DATABASE_SCHEMA.md",
      });
    } else {
      results.push({
        category: "Database Schema",
        status: "pass",
        message: `Table "${tableName}" is documented`,
      });
    }
  }

  // Check the documented table count matches
  const docTableCountMatch = schemaDocContent.match(/\*\*(\d+)\s+tables?\*\*/);
  if (docTableCountMatch) {
    const docCount = parseInt(docTableCountMatch[1], 10);
    if (docCount !== tableNames.length) {
      results.push({
        category: "Database Schema",
        status: "warning",
        message: `Table count mismatch: docs say ${docCount}, schema has ${tableNames.length}`,
        details: "Update the table count in DATABASE_SCHEMA.md",
      });
    }
  }

  return results;
}

/**
 * Validate that Python mock API and lab engine endpoints are documented.
 */
function validatePythonEndpoints(): ValidationResult[] {
  const results: ValidationResult[] = [];

  const apiRefContent = readFileOrNull(API_REFERENCE_FILE);
  if (!apiRefContent) {
    results.push({
      category: "Python Endpoints",
      status: "fail",
      message: "API_REFERENCE.md not found (needed for Python endpoint validation)",
    });
    return results;
  }

  // Define the Python API files to check
  const apiFiles: Array<{ name: string; file: string; prefix: string }> = [
    {
      name: "Lab Engine",
      file: path.join(SERVICES_DIR, "lab-engine", "main.py"),
      prefix: "/api/v1",
    },
    {
      name: "Mock Meraki",
      file: path.join(SERVICES_DIR, "lab-engine", "mock_apis", "meraki", "app.py"),
      prefix: "",
    },
    {
      name: "Mock Catalyst Center",
      file: path.join(SERVICES_DIR, "lab-engine", "mock_apis", "catalyst", "app.py"),
      prefix: "",
    },
    {
      name: "Mock Webex",
      file: path.join(SERVICES_DIR, "lab-engine", "mock_apis", "webex", "app.py"),
      prefix: "",
    },
  ];

  for (const api of apiFiles) {
    if (!fs.existsSync(api.file)) {
      results.push({
        category: "Python Endpoints",
        status: "warning",
        message: `${api.name} file not found`,
        details: `Expected at: ${path.relative(PROJECT_ROOT, api.file)}`,
      });
      continue;
    }

    const routes = extractPythonRoutes(api.file);

    if (routes.length === 0) {
      results.push({
        category: "Python Endpoints",
        status: "warning",
        message: `No routes found in ${api.name}`,
        details: `File: ${path.relative(PROJECT_ROOT, api.file)}`,
      });
      continue;
    }

    let documented = 0;
    let missing = 0;

    // Every path-like token in the doc, reduced to its URL shape, so a
    // parameter-name difference between the FastAPI decorator and the docs is
    // not reported as a missing endpoint.
    const docShapes = new Set(
      (apiRefContent.match(/(?:\/[A-Za-z0-9_.{}[\]-]+)+/g) ?? []).map(routeShape),
    );

    for (const route of routes) {
      const fullPath = api.prefix + route.path;
      // Check if the endpoint appears in the doc
      const pathInDoc =
        apiRefContent.includes(route.path) ||
        apiRefContent.includes(fullPath) ||
        docShapes.has(routeShape(route.path)) ||
        docShapes.has(routeShape(fullPath));

      if (!pathInDoc) {
        missing++;
        results.push({
          category: "Python Endpoints",
          status: "fail",
          message: `${api.name}: ${route.method} ${route.path} is not documented`,
          details: `File: ${path.relative(PROJECT_ROOT, api.file)}`,
        });
      } else {
        documented++;
      }
    }

    if (missing === 0) {
      results.push({
        category: "Python Endpoints",
        status: "pass",
        message: `${api.name}: All ${documented} endpoints documented`,
      });
    }
  }

  return results;
}

/**
 * Validate that documentation files exist and have minimum content.
 */
function validateDocFilesExist(): ValidationResult[] {
  const results: ValidationResult[] = [];

  const requiredDocs: Array<{ name: string; path: string; minSize: number }> = [
    { name: "ARCHITECTURE.md", path: path.join(DOCS_DIR, "ARCHITECTURE.md"), minSize: 1000 },
    { name: "API_REFERENCE.md", path: API_REFERENCE_FILE, minSize: 2000 },
    { name: "DATABASE_SCHEMA.md", path: DATABASE_SCHEMA_FILE, minSize: 1000 },
    { name: "ROUTES.md", path: ROUTES_FILE, minSize: 1000 },
    { name: "CONTENT_STRATEGY.md", path: path.join(DOCS_DIR, "CONTENT_STRATEGY.md"), minSize: 1000 },
  ];

  for (const doc of requiredDocs) {
    if (!fs.existsSync(doc.path)) {
      results.push({
        category: "Doc Files",
        status: "fail",
        message: `${doc.name} does not exist`,
        details: `Expected at: docs/${doc.name}`,
      });
    } else {
      const stat = fs.statSync(doc.path);
      if (stat.size < doc.minSize) {
        results.push({
          category: "Doc Files",
          status: "warning",
          message: `${doc.name} seems too small (${stat.size} bytes)`,
          details: `Expected at least ${doc.minSize} bytes of content`,
        });
      } else {
        results.push({
          category: "Doc Files",
          status: "pass",
          message: `${doc.name} exists (${(stat.size / 1024).toFixed(1)} KB)`,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function validate(): ValidationReport {
  const allResults: ValidationResult[] = [];

  // Run all validators
  allResults.push(...validateDocFilesExist());
  allResults.push(...validateApiRoutes());
  allResults.push(...validatePageRoutes());
  allResults.push(...validateDatabaseSchema());
  allResults.push(...validatePythonEndpoints());

  // Build summary
  const passed = allResults.filter((r) => r.status === "pass").length;
  const failed = allResults.filter((r) => r.status === "fail").length;
  const warnings = allResults.filter((r) => r.status === "warning").length;

  return {
    timestamp: new Date().toISOString(),
    passed: failed === 0,
    summary: {
      total: allResults.length,
      passed,
      failed,
      warnings,
    },
    results: allResults,
  };
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

const report = validate();
const jsonMode = process.argv.includes("--json");

if (jsonMode) {
  // JSON output mode
  console.log(JSON.stringify(report, null, 2));
} else {
  // Human-readable output
  const statusIcons = {
    pass: "[PASS]",
    fail: "[FAIL]",
    warning: "[WARN]",
  };

  console.log("=".repeat(70));
  console.log("  DevNet StudyLab -- Documentation Validation Report");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Timestamp: ${report.timestamp}`);
  console.log(`  Status:    ${report.passed ? "ALL CHECKS PASSED" : "GAPS DETECTED"}`);
  console.log();
  console.log("  Summary:");
  console.log(`    Total checks:  ${report.summary.total}`);
  console.log(`    Passed:        ${report.summary.passed}`);
  console.log(`    Failed:        ${report.summary.failed}`);
  console.log(`    Warnings:      ${report.summary.warnings}`);
  console.log();

  // Group results by category
  const categories = new Map<string, ValidationResult[]>();
  for (const result of report.results) {
    const list = categories.get(result.category) || [];
    list.push(result);
    categories.set(result.category, list);
  }

  for (const [category, results] of categories) {
    const categoryFails = results.filter((r) => r.status === "fail").length;
    const categoryWarns = results.filter((r) => r.status === "warning").length;
    const categoryStatus =
      categoryFails > 0
        ? "[FAIL]"
        : categoryWarns > 0
          ? "[WARN]"
          : "[PASS]";

    console.log(`  ${categoryStatus} ${category}`);
    console.log("  " + "-".repeat(66));

    for (const result of results) {
      const icon = statusIcons[result.status];
      console.log(`    ${icon} ${result.message}`);
      if (result.details && result.status !== "pass") {
        console.log(`           ${result.details}`);
      }
    }
    console.log();
  }

  console.log("=".repeat(70));
  if (report.passed) {
    console.log("  All documentation is up to date.");
  } else {
    console.log(
      `  Documentation gaps detected. ${report.summary.failed} issue(s) need attention.`
    );
  }
  console.log("=".repeat(70));
}

// Exit with appropriate code
process.exit(report.passed ? 0 : 1);

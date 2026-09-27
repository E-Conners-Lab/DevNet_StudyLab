#!/usr/bin/env tsx
/**
 * DevNet StudyLab -- Documentation Manifest Generator
 *
 * Scans the project for API routes, page routes, database schema tables,
 * and mock API endpoints. Produces a consolidated JSON manifest at
 * docs/manifest.json and prints a summary to stdout.
 *
 * Usage:
 *   npx tsx scripts/generate-docs.ts
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
const OUTPUT_FILE = path.join(DOCS_DIR, "manifest.json");

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
      // Skip node_modules and hidden directories
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
  // Remove the filename (page.tsx or route.ts)
  relative = path.dirname(relative);
  // Convert to URL path
  let route = "/" + relative.split(path.sep).join("/");
  // Clean up root
  if (route === "/.") route = "/";
  return route;
}

/**
 * Extract HTTP methods from a route.ts file by scanning for exported function names.
 */
function extractMethods(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const methods: string[] = [];
  const methodNames = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  for (const method of methodNames) {
    // Match: export async function GET, export function GET, export const GET
    const pattern = new RegExp(
      `export\\s+(?:async\\s+)?(?:function|const)\\s+${method}\\b`
    );
    if (pattern.test(content)) {
      methods.push(method);
    }
  }
  return methods;
}

/**
 * Parse the Drizzle ORM schema file to extract table names and columns.
 */
function parseSchemaFile(schemaPath: string): Array<{
  name: string;
  columns: string[];
}> {
  if (!fs.existsSync(schemaPath)) return [];

  const content = fs.readFileSync(schemaPath, "utf-8");
  const tables: Array<{ name: string; columns: string[] }> = [];

  // Match pgTable declarations: export const tableName = pgTable("table_name", { ... })
  const tableRegex =
    /export\s+const\s+(\w+)\s*=\s*pgTable\(\s*"([^"]+)"\s*,\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[2];
    const columnsBlock = match[3];

    // Extract column names from the columns block
    const columnRegex = /(\w+)\s*:\s*(?:uuid|text|serial|integer|timestamp|boolean|real|jsonb|pgEnum)\b/g;
    const columns: string[] = [];
    let colMatch: RegExpExecArray | null;
    while ((colMatch = columnRegex.exec(columnsBlock)) !== null) {
      columns.push(colMatch[1]);
    }

    // Also catch columns defined with method calls like .notNull()
    const simpleColumnRegex = /^\s*(\w+)\s*:/gm;
    const allCols = new Set(columns);
    let simpleMatch: RegExpExecArray | null;
    while ((simpleMatch = simpleColumnRegex.exec(columnsBlock)) !== null) {
      const colName = simpleMatch[1];
      // Filter out common non-column identifiers
      if (!["mode", "columns", "onDelete", "onUpdate"].includes(colName)) {
        allCols.add(colName);
      }
    }

    tables.push({
      name: tableName,
      columns: Array.from(allCols),
    });
  }

  return tables;
}

/**
 * Parse a Python FastAPI file to extract route definitions.
 */
function parsePythonRoutes(
  filePath: string
): Array<{ method: string; path: string }> {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const routes: Array<{ method: string; path: string }> = [];

  // Match @router.get("/path"), @router.post("/path"), @app.get("/path"), etc.
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Manifest {
  generatedAt: string;
  projectRoot: string;
  apiRoutes: Array<{
    path: string;
    methods: string[];
    file: string;
  }>;
  pageRoutes: Array<{
    path: string;
    file: string;
  }>;
  databaseTables: Array<{
    name: string;
    columns: string[];
  }>;
  mockApis: {
    meraki: Array<{ method: string; path: string }>;
    catalyst: Array<{ method: string; path: string }>;
    webex: Array<{ method: string; path: string }>;
  };
  labEngine: Array<{ method: string; path: string }>;
  summary: {
    totalApiRoutes: number;
    totalPageRoutes: number;
    totalDatabaseTables: number;
    totalMockEndpoints: number;
    totalLabEngineEndpoints: number;
  };
}

function generate(): Manifest {
  const appDir = path.join(WEB_APP_SRC, "app");

  // ── API Routes ──────────────────────────────────────────────
  const apiRouteFiles = findFiles(appDir, (f) =>
    f.endsWith("route.ts") || f.endsWith("route.js")
  );

  const apiRoutes = apiRouteFiles.map((file) => ({
    path: filePathToRoute(file, appDir),
    methods: extractMethods(file),
    file: path.relative(PROJECT_ROOT, file),
  }));

  // ── Page Routes ─────────────────────────────────────────────
  const pageFiles = findFiles(appDir, (f) =>
    f.endsWith("page.tsx") || f.endsWith("page.jsx") || f.endsWith("page.ts")
  );

  const pageRoutes = pageFiles.map((file) => ({
    path: filePathToRoute(file, appDir),
    file: path.relative(PROJECT_ROOT, file),
  }));

  // ── Database Schema ─────────────────────────────────────────
  const schemaPath = path.join(WEB_APP_SRC, "lib", "db", "schema.ts");
  const databaseTables = parseSchemaFile(schemaPath);

  // ── Mock API Endpoints ──────────────────────────────────────
  const merakiRoutes = parsePythonRoutes(
    path.join(SERVICES_DIR, "lab-engine", "mock_apis", "meraki", "app.py")
  );
  const catalystRoutes = parsePythonRoutes(
    path.join(SERVICES_DIR, "lab-engine", "mock_apis", "catalyst", "app.py")
  );
  const webexRoutes = parsePythonRoutes(
    path.join(SERVICES_DIR, "lab-engine", "mock_apis", "webex", "app.py")
  );

  // ── Lab Engine Endpoints ────────────────────────────────────
  const labEngineRoutes = parsePythonRoutes(
    path.join(SERVICES_DIR, "lab-engine", "main.py")
  );

  // ── Build manifest ──────────────────────────────────────────
  const totalMockEndpoints =
    merakiRoutes.length + catalystRoutes.length + webexRoutes.length;

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    apiRoutes,
    pageRoutes,
    databaseTables,
    mockApis: {
      meraki: merakiRoutes,
      catalyst: catalystRoutes,
      webex: webexRoutes,
    },
    labEngine: labEngineRoutes,
    summary: {
      totalApiRoutes: apiRoutes.length,
      totalPageRoutes: pageRoutes.length,
      totalDatabaseTables: databaseTables.length,
      totalMockEndpoints,
      totalLabEngineEndpoints: labEngineRoutes.length,
    },
  };

  return manifest;
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

const manifest = generate();

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// Write manifest
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + "\n");

// Print summary
console.log("=".repeat(60));
console.log("  DevNet StudyLab -- Documentation Manifest");
console.log("=".repeat(60));
console.log();
console.log(`  Generated at: ${manifest.generatedAt}`);
console.log(`  Output file:  ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
console.log();
console.log("  Summary:");
console.log(`    API Routes:           ${manifest.summary.totalApiRoutes}`);
console.log(`    Page Routes:          ${manifest.summary.totalPageRoutes}`);
console.log(`    Database Tables:      ${manifest.summary.totalDatabaseTables}`);
console.log(`    Mock API Endpoints:   ${manifest.summary.totalMockEndpoints}`);
console.log(`      - Meraki:           ${manifest.mockApis.meraki.length}`);
console.log(`      - Catalyst Center:  ${manifest.mockApis.catalyst.length}`);
console.log(`      - Webex:            ${manifest.mockApis.webex.length}`);
console.log(`    Lab Engine Endpoints: ${manifest.summary.totalLabEngineEndpoints}`);
console.log();

// Detail: API routes
if (manifest.apiRoutes.length > 0) {
  console.log("  API Routes:");
  for (const route of manifest.apiRoutes) {
    console.log(`    ${route.methods.join(", ").padEnd(8)} ${route.path}`);
  }
  console.log();
}

// Detail: Page routes
if (manifest.pageRoutes.length > 0) {
  console.log("  Page Routes:");
  for (const route of manifest.pageRoutes) {
    console.log(`    ${route.path}`);
  }
  console.log();
}

// Detail: Database tables
if (manifest.databaseTables.length > 0) {
  console.log("  Database Tables:");
  for (const table of manifest.databaseTables) {
    console.log(`    ${table.name} (${table.columns.length} columns)`);
  }
  console.log();
}

console.log("=".repeat(60));
console.log("  Manifest generated successfully.");
console.log("=".repeat(60));

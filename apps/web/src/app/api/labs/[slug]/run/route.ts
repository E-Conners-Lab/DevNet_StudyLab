import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { getLabForRun, saveLabAttempt } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { jsonOk, jsonNotFound, jsonBadRequest, jsonError } from "@/lib/api-helpers";

// ---------------------------------------------------------------------------
// Lab types that can be executed as Python scripts
// ---------------------------------------------------------------------------

const PYTHON_LAB_TYPES = new Set(["python", "netconf", "api"]);

// ---------------------------------------------------------------------------
// Run Python code locally via subprocess
// ---------------------------------------------------------------------------

async function runPythonLocally(
  code: string,
): Promise<{ success: boolean; output: string; executionTime: number }> {
  const tmpFile = path.join(tmpdir(), `studylab-${randomUUID()}.py`);
  const start = Date.now();

  try {
    await writeFile(tmpFile, code, "utf-8");

    const result = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        execFile(
          "python3",
          [tmpFile],
          { timeout: 30_000, maxBuffer: 1024 * 512 },
          (error, stdout, stderr) => {
            if (error && !stdout && !stderr) {
              reject(error);
            } else {
              resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
            }
          },
        );
      },
    );

    const elapsed = Date.now() - start;
    const output = (result.stdout + result.stderr).trim();

    return {
      success: !result.stderr,
      output: output || "(no output)",
      executionTime: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown execution error";
    // Extract useful Python traceback from the error
    const match = message.match(/\n(Traceback[\s\S]*)/);
    return {
      success: false,
      output: match ? match[1].trim() : message,
      executionTime: elapsed,
    };
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// POST /api/labs/[slug]/run
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const lab = getLabForRun(slug);

    if (!lab) {
      return jsonNotFound(`Lab "${slug}"`);
    }

    // Parse and validate request body
    let body: { code: string };
    try {
      body = await request.json();
    } catch {
      return jsonBadRequest("Invalid JSON in request body");
    }

    const { code } = body;

    if (!code || typeof code !== "string") {
      return jsonBadRequest('"code" string is required');
    }

    // Try to proxy to the Docker lab engine (only if explicitly configured)
    const LAB_ENGINE_URL = process.env.LAB_ENGINE_URL;

    if (LAB_ENGINE_URL) {
      try {
        const engineResponse = await fetch(LAB_ENGINE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language: lab.type,
            slug,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const engineData = await engineResponse.json();

        // Fire-and-forget: save lab attempt to DB
        const userId = await getCurrentUserId();
        if (userId) {
          const status = engineResponse.ok ? "completed" : "failed";
          saveLabAttempt(userId, slug, status, code).catch((err) =>
            console.warn("Background lab attempt save failed:", err),
          );
        }

        return jsonOk({
          success: engineResponse.ok,
          output: engineData.output ?? engineData.error ?? "No output",
          executionTime: engineData.executionTime ?? 0,
          engineAvailable: true,
        });
      } catch {
        // Engine configured but unavailable — fall through to local execution
      }
    }

    // Python-based labs: execute locally via python3 subprocess
    if (PYTHON_LAB_TYPES.has(lab.type)) {
      const result = await runPythonLocally(code);

      // Fire-and-forget: save lab attempt to DB
      const userId = await getCurrentUserId();
      if (userId) {
        const status = result.success ? "completed" : "failed";
        saveLabAttempt(userId, slug, status, code).catch((err) =>
          console.warn("Background lab attempt save failed:", err),
        );
      }

      return jsonOk({
        success: result.success,
        output: result.output,
        executionTime: result.executionTime,
        engineAvailable: false,
      });
    }

    // Non-Python labs need Docker
    const userId = await getCurrentUserId();
    if (userId) {
      saveLabAttempt(userId, slug, "started", code).catch((err) =>
        console.warn("Background lab attempt save failed:", err),
      );
    }

    return jsonOk({
      success: true,
      output:
        "This lab requires the Docker lab engine. Set LAB_ENGINE_URL and start Docker services to execute code.",
      executionTime: 0,
      engineAvailable: false,
    });
  } catch (error) {
    console.error("Error running lab code:", error);
    return jsonError("Failed to run code");
  }
}

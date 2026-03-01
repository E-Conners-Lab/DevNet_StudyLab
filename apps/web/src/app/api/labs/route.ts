import { NextRequest } from "next/server";
import { listLabs } from "@/lib/data";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");
    const domainFilter = searchParams.get("domain");

    const labs = await listLabs({
      type: typeFilter ?? undefined,
      domain: domainFilter ?? undefined,
    });

    return jsonOk({ labs });
  } catch (error) {
    console.error("Error loading labs:", error);
    return jsonError("Failed to load labs");
  }
}

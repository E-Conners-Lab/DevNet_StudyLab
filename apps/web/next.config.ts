import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// This repo is not an npm workspace - the root package.json holds only shared
// dev tooling, while the app's real dependency tree lives in
// apps/web/package-lock.json. Turbopack otherwise infers the repo root from the
// first lockfile it finds and warns about the ambiguity, so pin it here.
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const cacheDir = path.join(projectRoot, ".next", "dev", "cache", "turbopack");
const nextBin = path.join(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const maxCacheMb = Number.parseInt(
  process.env.TURBOPACK_CACHE_GUARD_MAX_MB ?? "384",
  10
);
const defaultMaxOldSpaceMb = process.env.TURBOPACK_MAX_OLD_SPACE_MB ?? "1024";
const forceClear = process.env.TURBOPACK_CACHE_GUARD_FORCE_CLEAR === "1";
const skipGuard = process.env.TURBOPACK_CACHE_GUARD_SKIP === "1";
const forwardedArgs = process.argv.slice(2);

async function getDirSizeBytes(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      total += await getDirSizeBytes(entryPath);
      continue;
    }

    if (entry.isFile()) {
      const stat = await fs.stat(entryPath);
      total += stat.size;
    }
  }

  return total;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function withDefaultNodeOptions(env) {
  const current = env.NODE_OPTIONS?.trim() ?? "";
  if (current.includes("--max-old-space-size")) {
    return env;
  }

  return {
    ...env,
    NODE_OPTIONS: [current, `--max-old-space-size=${defaultMaxOldSpaceMb}`]
      .filter(Boolean)
      .join(" "),
  };
}

async function guardCache() {
  if (skipGuard) {
    return;
  }

  try {
    const sizeBytes = await getDirSizeBytes(cacheDir);
    const limitBytes = maxCacheMb * 1024 * 1024;

    if (!forceClear && sizeBytes <= limitBytes) {
      return;
    }

    console.log(
      `[dev] clearing Turbopack cache at ${cacheDir} (${formatMb(sizeBytes)})`
    );
    await fs.rm(cacheDir, { recursive: true, force: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

await guardCache();

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--turbopack", ...forwardedArgs],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: withDefaultNodeOptions(process.env),
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

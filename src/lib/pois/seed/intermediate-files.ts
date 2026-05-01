// src/lib/pois/seed/intermediate-files.ts
// JSON file I/O between seeding passes. Files live under /tmp/seed-pois/
// so they're not committed.

import { promises as fs } from "node:fs";
import path from "node:path";

const SEED_DIR = "/tmp/seed-pois";

export async function ensureSeedDir(): Promise<void> {
  await fs.mkdir(SEED_DIR, { recursive: true });
}

export async function writeIntermediate<T>(
  name: string,
  data: T
): Promise<string> {
  await ensureSeedDir();
  const filePath = path.join(SEED_DIR, name);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}

export async function readIntermediate<T>(name: string): Promise<T> {
  const filePath = path.join(SEED_DIR, name);
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function intermediateExists(name: string): Promise<boolean> {
  try {
    await fs.access(path.join(SEED_DIR, name));
    return true;
  } catch {
    return false;
  }
}

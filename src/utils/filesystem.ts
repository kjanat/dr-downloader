import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type FileFilter = (filename: string) => boolean;

export async function findNewestFile(
  dir: string,
  filter: FileFilter,
): Promise<string | null> {
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }

  const candidates = files.filter(filter);
  if (!candidates.length) return null;

  const withTimes = await Promise.all(
    candidates.map(async (f) => {
      const p = join(dir, f);
      const s = await stat(p).catch(() => null);
      return { f, t: s?.mtimeMs ?? 0 };
    }),
  );

  withTimes.sort((a, b) => b.t - a.t);
  const newest = withTimes[0]?.f;
  return newest ? join(dir, newest) : null;
}

export async function waitForFileStability(
  filePath: string,
  checks: number = 3,
  intervalMs: number = 3000,
): Promise<boolean> {
  let last = -1;
  let stable = 0;

  while (stable < checks) {
    const size = await getFileSize(filePath);
    if (size > 0 && size === last) {
      stable++;
    } else {
      stable = 0;
      last = size;
    }
    await sleep(intervalMs);
  }

  return true;
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

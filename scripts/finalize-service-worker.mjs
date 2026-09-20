import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const SW = join(DIST, "sw.js");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute)));
      continue;
    }

    if (!entry.isFile() || entry.name === "sw.js") continue;

    files.push(absolute);
  }

  return files;
}

const files = await collectFiles(DIST);
const relativeFiles = files
  .map((absolute) => relative(DIST, absolute).split(sep).join("/"))
  .filter((path) => path !== "index.html")
  .sort();

const precache = ["./", ...relativeFiles.map((path) => `./${path}`)];
const fingerprint = createHash("sha256")
  .update(JSON.stringify(precache))
  .digest("hex")
  .slice(0, 12);

let source = await readFile(SW, "utf8");

if (
  !source.includes("__DAYDOCK_CACHE__") ||
  !source.includes("__DAYDOCK_PRECACHE__")
) {
  throw new Error("Service worker placeholders were not found.");
}

source = source
  .replace("__DAYDOCK_CACHE__", `daydock-shell-${fingerprint}`)
  .replace("__DAYDOCK_PRECACHE__", JSON.stringify(precache, null, 2));

await writeFile(SW, source);

process.stdout.write(
  `Finalized DayDock service worker with ${precache.length} precached resources (${fingerprint}).\n`,
);

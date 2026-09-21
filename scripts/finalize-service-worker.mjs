import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";
import { Script } from "node:vm";
import { fileURLToPath, URL } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const SW = join(DIST, "sw.js");
const CACHE_ASSIGNMENT = 'const CACHE = "__DAYDOCK_CACHE__";';
const PRECACHE_ASSIGNMENT = "const PRECACHE = __DAYDOCK_PRECACHE__;";

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
const cacheName = `daydock-shell-${fingerprint}`;

let source = await readFile(SW, "utf8");

if (!source.includes(CACHE_ASSIGNMENT)) {
  throw new Error("Service worker cache placeholder assignment was not found.");
}

if (!source.includes(PRECACHE_ASSIGNMENT)) {
  throw new Error("Service worker precache placeholder assignment was not found.");
}

source = source
  .replace(CACHE_ASSIGNMENT, `const CACHE = ${JSON.stringify(cacheName)};`)
  .replace(
    PRECACHE_ASSIGNMENT,
    `const PRECACHE = ${JSON.stringify(precache, null, 2)};`,
  );

if (
  source.includes(CACHE_ASSIGNMENT) ||
  source.includes(PRECACHE_ASSIGNMENT)
) {
  throw new Error(
    "Service worker build placeholder assignments remain after finalization.",
  );
}

// Compile without executing. This catches malformed generated JavaScript before
// the browser sees the service worker.
new Script(source, { filename: "dist/sw.js" });

await writeFile(SW, source);

process.stdout.write(
  `Finalized DayDock service worker with ${precache.length} precached resources (${fingerprint}).\n`,
);

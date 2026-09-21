import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const EXPECTED_BASE = "/daydock/";
const LEGACY_BASE = "/Employees-template-React-App/";
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const INDEX = join(DIST, "index.html");

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(absolute)));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(?:html|js|css|json|webmanifest|svg|txt)$/i.test(entry.name)
    ) {
      files.push(absolute);
    }
  }

  return files;
}

function stripQueryAndHash(value) {
  return value.split(/[?#]/, 1)[0] ?? value;
}

const index = await readFile(INDEX, "utf8");
const absoluteReferences = Array.from(
  index.matchAll(/\b(?:src|href)="(\/[^"#]+)"/g),
  (match) => match[1],
);

if (absoluteReferences.length === 0) {
  throw new Error("Pages build contains no absolute asset references to verify.");
}

const invalidReferences = absoluteReferences.filter(
  (reference) => !reference.startsWith(EXPECTED_BASE),
);

if (invalidReferences.length > 0) {
  throw new Error(
    `Pages build escaped ${EXPECTED_BASE}: ${invalidReferences.join(", ")}`,
  );
}

const assetReferences = absoluteReferences.filter((reference) =>
  reference.startsWith(`${EXPECTED_BASE}assets/`),
);

if (!assetReferences.some((reference) => /\.js(?:[?#]|$)/.test(reference))) {
  throw new Error("Pages build does not reference a JavaScript bundle.");
}

if (!assetReferences.some((reference) => /\.css(?:[?#]|$)/.test(reference))) {
  throw new Error("Pages build does not reference a CSS bundle.");
}

for (const reference of assetReferences) {
  const relativePath = stripQueryAndHash(reference).slice(EXPECTED_BASE.length);
  const target = join(DIST, relativePath);

  try {
    const targetStat = await stat(target);
    if (!targetStat.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new Error(
      `Pages asset reference does not resolve inside dist: ${reference}`,
    );
  }
}

const textFiles = await collectTextFiles(DIST);

for (const file of textFiles) {
  const source = await readFile(file, "utf8");

  if (source.includes(LEGACY_BASE)) {
    throw new Error(
      `Legacy GitHub Pages base ${LEGACY_BASE} remains in ${file}`,
    );
  }
}

process.stdout.write(
  `Verified GitHub Pages artifact base ${EXPECTED_BASE} and ${assetReferences.length} emitted asset references.\n`,
);

import fs from "fs/promises";
import crypto from "crypto";

const SCRYFALL_URL =
  "https://api.scryfall.com/cards/search?q=legal%3Acommander+is%3Acommander&unique=cards&order=name";

const OUT_FILE     = "assets/core_v2.json";
const VERSION_FILE = "assets/version.json";

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function readCurrentVersion() {
  if (!(await exists(VERSION_FILE))) return 0;
  const raw = await fs.readFile(VERSION_FILE, "utf8");
  return JSON.parse(raw).version ?? 0;
}

async function readPreviousHash() {
  if (!(await exists(VERSION_FILE))) return null;
  const raw = await fs.readFile(VERSION_FILE, "utf8");
  return JSON.parse(raw).hash ?? null;
}

function hashCards(data) {
  const normalized = data
    .map(card => card.i)
    .filter(Boolean)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

async function pull() {
  let next = SCRYFALL_URL;
  const out = [];

  while (next) {
    const res = await fetch(next, {
      headers: {
        "User-Agent": "dynamic-asset-node",
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Scryfall error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    for (const c of json.data) {
      out.push({
        i:  c.oracle_id,
        n:  c.name,
        ci: c.color_identity ?? [],
        o:  c.oracle_text ?? ""
      });
    }

    next = json.has_more ? json.next_page : null;
  }

  return out;
}

const data = await pull();

await fs.mkdir("assets", { recursive: true });

const currentVersion = await readCurrentVersion();
const previousHash   = await readPreviousHash();
const currentHash    = hashCards(data);

const hasChanged  = previousHash !== currentHash;
const nextVersion = hasChanged ? currentVersion + 1 : currentVersion;
const updatedAt   = new Date().toISOString();

await fs.writeFile(
  OUT_FILE,
  JSON.stringify({
    version:    nextVersion,
    updated_at: updatedAt,
    ts:         Date.now(),
    c:          data.length,
    h:          currentHash,
    d:          data
  })
);

await fs.writeFile(
  VERSION_FILE,
  JSON.stringify({
    version:    nextVersion,
    updated_at: updatedAt,
    count:      data.length,
    changed:    hasChanged,
    hash_type:  "oracle_ids",
    hash:       currentHash
  })
);

console.log(
  hasChanged
    ? `updated to version ${nextVersion}`
    : `no card changes; version remains ${nextVersion}`
);

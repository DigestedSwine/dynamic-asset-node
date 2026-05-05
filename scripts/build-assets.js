import fs from "fs/promises";

const URL =
  "https://api.scryfall.com/cards/search?q=legal%3Acommander+is%3Acommander&unique=cards&order=name";

const OUT_FILE = "assets/core_v1.json";
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

async function pull() {
  let next = URL;
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
        i: c.id,
        o: c.oracle_id,
        n: c.name,
        t: c.type_line,
        ci: c.color_identity ?? [],
        cmc: c.cmc,
        txt: c.oracle_text ?? "",
        pw: c.type_line?.includes("Planeswalker") ?? false,
        u: c.scryfall_uri
      });
    }

    next = json.has_more ? json.next_page : null;
  }

  return out;
}

async function readExistingData() {
  if (!(await exists(OUT_FILE))) return null;

  const raw = await fs.readFile(OUT_FILE, "utf8");
  const parsed = JSON.parse(raw);

  return parsed.d ?? null;
}

const data = await pull();

await fs.mkdir("assets", { recursive: true });

const currentData = await readExistingData();
const currentVersion = await readCurrentVersion();

const hasChanged = JSON.stringify(currentData) !== JSON.stringify(data);
const nextVersion = hasChanged ? currentVersion + 1 : currentVersion;

const payload = {
  version: nextVersion,
  updated_at: new Date().toISOString(),
  ts: Date.now(),
  c: data.length,
  d: data
};

await fs.writeFile(OUT_FILE, JSON.stringify(payload));

await fs.writeFile(
  VERSION_FILE,
  JSON.stringify({
    version: nextVersion,
    updated_at: payload.updated_at,
    count: data.length,
    changed: hasChanged
  })
);

console.log(
  hasChanged
    ? `updated to version ${nextVersion}`
    : `no change; version remains ${nextVersion}`
);

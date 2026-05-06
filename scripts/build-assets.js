import fs from "fs/promises";
import crypto from "crypto";

const URL =
  "https://api.scryfall.com/cards/search?q=legal%3Acommander+is%3Acommander&unique=cards&order=name";

const OUT_FILE = "assets/core_v1.json";
const OUT_FILE_V2 = "assets/core_v2.json";
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

function hashUniqueCards(data) {
  const normalized = data
    .map(card => card.o)
    .filter(Boolean)
    .sort()
    .join("\n");

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/* =========================
   ENRICHMENT LOGIC
========================= */

function getTags(card) {
  const text = `${card.txt ?? ""} ${card.t ?? ""}`.toLowerCase();
  const tags = [];

  if (text.includes("create") && text.includes("token")) tags.push("tokens");
  if (text.includes("+1/+1 counter") || text.includes("proliferate")) tags.push("counters");
  if (text.includes("graveyard") || text.includes("reanimate")) tags.push("graveyard");
  if (text.includes("artifact")) tags.push("artifacts");
  if (text.includes("enchantment")) tags.push("enchantments");
  if (text.includes("draw a card")) tags.push("card-draw");
  if (text.includes("sacrifice")) tags.push("sacrifice");
  if (text.includes("land")) tags.push("lands");
  if (text.includes("instant") || text.includes("sorcery")) tags.push("spellslinger");
  if (text.includes("equipment") || text.includes("aura")) tags.push("voltron");
  if (text.includes("gain life")) tags.push("lifegain");
  if (text.includes("mill")) tags.push("mill");
  if (text.includes("treasure")) tags.push("treasure");

  return [...new Set(tags)];
}

function getPlaystyles(tags) {
  const ps = [];

  if (tags.includes("tokens")) ps.push("go-wide");
  if (tags.includes("voltron")) ps.push("voltron");
  if (tags.includes("sacrifice")) ps.push("aristocrats");
  if (tags.includes("graveyard")) ps.push("recursion");
  if (tags.includes("spellslinger")) ps.push("spellslinger");
  if (tags.includes("artifacts")) ps.push("artifact-synergy");
  if (tags.includes("counters")) ps.push("scaling-value");
  if (tags.includes("treasure")) ps.push("ramp-value");

  return [...new Set(ps)];
}

function getSpeed(card, tags) {
  if (card.cmc <= 2) return "fast";
  if (tags.includes("treasure")) return "fast-mid";
  if (card.cmc >= 6) return "slow";
  return "midrange";
}

function getComplexity(card, tags) {
  const text = card.txt ?? "";
  let score = 0;

  if (text.length > 300) score += 2;
  if (tags.length >= 4) score += 2;
  if (text.includes("choose")) score += 1;
  if (text.includes("whenever")) score += 1;
  if (text.includes("instead")) score += 1;

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

/* =========================
   FETCH DATA
========================= */

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

/* =========================
   MAIN EXECUTION
========================= */

const data = await pull();

// enriched layer
const enriched = data.map(card => {
  const tags = getTags(card);
  const playstyle = getPlaystyles(tags);

  return {
    ...card,
    tg: tags,
    ps: playstyle,
    sp: getSpeed(card, tags),
    cx: getComplexity(card, tags)
  };
});

await fs.mkdir("assets", { recursive: true });

const currentVersion = await readCurrentVersion();
const previousHash = await readPreviousHash();
const currentHash = hashUniqueCards(data);

const hasChanged = previousHash !== currentHash;
const nextVersion = hasChanged ? currentVersion + 1 : currentVersion;

const updatedAt = new Date().toISOString();

/* =========================
   WRITE FILES
========================= */

const payload = {
  version: nextVersion,
  updated_at: updatedAt,
  ts: Date.now(),
  c: data.length,
  h: currentHash,
  d: data
};

await fs.writeFile(OUT_FILE, JSON.stringify(payload));

await fs.writeFile(
  OUT_FILE_V2,
  JSON.stringify({
    ...payload,
    d: enriched
  })
);

await fs.writeFile(
  VERSION_FILE,
  JSON.stringify({
    version: nextVersion,
    updated_at: updatedAt,
    count: data.length,
    changed: hasChanged,
    hash_type: "unique_oracle_ids",
    hash: currentHash
  })
);

console.log(
  hasChanged
    ? `updated to version ${nextVersion}`
    : `no unique card changes; version remains ${nextVersion}`
);

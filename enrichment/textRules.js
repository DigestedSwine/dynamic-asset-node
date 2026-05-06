// enrichment/textRules.js

function normalizeText(txt = "") {
  return txt
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s{},().+/-]/g, "");
}

const RULES = {
  triggers: [
    { re: /whenever .* enters/, tag: "etb_trigger" },
    { re: /whenever .* attacks/, tag: "attack_trigger" },
    { re: /whenever .* dies/, tag: "death_trigger" },
    { re: /whenever you cast/, tag: "cast_trigger" },
    { re: /at the beginning of (your|each) (upkeep|combat|end step)/, tag: "phase_trigger" },
    { re: /whenever you draw/, tag: "draw_trigger" },
    { re: /whenever land enters/, tag: "landfall_trigger" }
  ],

  wincons: [
    { re: /each opponent loses .* life/, tag: "life_drain" },
    { re: /opponent loses .* life/, tag: "life_drain_single" },
    { re: /you win the game/, tag: "alt_wincon" },
    { re: /commander damage/, tag: "commander_damage" },
    { re: /deal .* damage to each opponent/, tag: "global_burn" },
    { re: /extra turn/, tag: "extra_turn_snowball" },
    { re: /can't lose the game/, tag: "soft_lock" }
  ],

  engines: [
    { re: /create .* token/, tag: "token_engine" },
    { re: /draw a card/, tag: "card_draw_engine" },
    { re: /return .* from .*graveyard/, tag: "recursion_engine" },
    { re: /reanimate/, tag: "reanimation_engine" },
    { re: /exile .* return/, tag: "blink_engine" },
    { re: /sacrifice/, tag: "sacrifice_engine" },
    { re: /play an additional land/, tag: "ramp_engine" },
    { re: /copy .* spell/, tag: "copy_engine" }
  ],

  scaling: [
    { re: /\+1\/\+1 counter/, tag: "counter_scaling" },
    { re: /for each/, tag: "state_scaling" },
    { re: /equal to the number of/, tag: "dynamic_scaling" },
    { re: /twice that many/, tag: "doubling_scaling" },
    { re: /whenever .* another/, tag: "stacking_growth" }
  ],

  interaction: [
    { re: /destroy target/, tag: "removal" },
    { re: /exile target/, tag: "exile_removal" },
    { re: /counter target/, tag: "counter_magic" },
    { re: /can't attack/, tag: "combat_lock" },
    { re: /can't cast/, tag: "spell_lock" },
    { re: /discard/, tag: "hand_attack" }
  ],

  conversion: [
    { re: /sacrifice .* draw/, tag: "life_to_cards" },
    { re: /life .* draw/, tag: "life_as_resource" },
    { re: /discard .* draw/, tag: "filter_engine" },
    { re: /tap .* add/, tag: "mana_engine" }
  ]
};

const ARCHETYPES = [
  {
    name: "aristocrats",
    requires: ["sacrifice_engine", "life_drain"],
    bonus: ["death_trigger"]
  },
  {
    name: "go_wide_tokens",
    requires: ["token_engine"],
    bonus: ["attack_trigger"]
  },
  {
    name: "spellslinger",
    requires: ["cast_trigger", "copy_engine"],
    bonus: ["card_draw_engine"]
  },
  {
    name: "lands_matter",
    requires: ["ramp_engine"],
    bonus: ["landfall_trigger"]
  },
  {
    name: "graveyard_value",
    requires: ["recursion_engine"],
    bonus: ["death_trigger"]
  },
  {
    name: "control_lock",
    requires: ["counter_magic", "combat_lock"],
    bonus: ["card_draw_engine"]
  }
];

function scanCategory(text, patterns) {
  const hits = [];
  for (const p of patterns) {
    if (p.re.test(text)) hits.push(p.tag);
  }
  return hits;
}

function detectArchetype(signals) {
  const active = [];

  for (const a of ARCHETYPES) {
    const hasCore = a.requires.every(r => signals.includes(r));
    const hasBonus = a.bonus.some(b => signals.includes(b));

    if (hasCore || (a.requires.some(r => signals.includes(r)) && hasBonus)) {
      active.push(a.name);
    }
  }

  return active;
}

function analyzeCommanderText(txt = "") {
  const text = normalizeText(txt);

  const triggers = scanCategory(text, RULES.triggers);
  const win_conditions = scanCategory(text, RULES.wincons);
  const engines = scanCategory(text, RULES.engines);
  const scaling = scanCategory(text, RULES.scaling);
  const interaction = scanCategory(text, RULES.interaction);
  const conversion = scanCategory(text, RULES.conversion);

  const allSignals = [
    ...triggers,
    ...win_conditions,
    ...engines,
    ...scaling,
    ...interaction,
    ...conversion
  ];

  const archetype = detectArchetype(allSignals);

  return {
    triggers,
    win_conditions,
    engines,
    scaling,
    interaction,
    conversion,

    // 🔥 NEW OUTPUT LAYER
    archetype
  };
}

module.exports = { analyzeCommanderText };

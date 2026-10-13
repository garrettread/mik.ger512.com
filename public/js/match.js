// Lifestyle → plant recommendations. Pure functions; the view lives in views/match.js.

export const QUESTIONS = [
  {
    id: "light", label: "How much light does your brightest plant spot get?",
    options: [
      ["1", "Low — north-facing or few windows"],
      ["2", "Medium — a few feet from a window"],
      ["3", "Bright but indirect — near an east/west window"],
      ["4", "Direct sun — a sunny south-facing window"],
    ],
  },
  {
    id: "time", label: "How much time can you give your plants each week?",
    options: [
      ["1", "Barely any — I'll forget they exist"],
      ["2", "About 5–10 minutes"],
      ["3", "15–30 minutes"],
      ["4", "As much as they need — it's my hobby"],
    ],
  },
  {
    id: "experience", label: "How experienced are you with plants?",
    options: [
      ["1", "Total beginner (or I've killed a cactus)"],
      ["2", "I've kept a few alive"],
      ["3", "Confident — I know my way around"],
      ["4", "Very experienced"],
    ],
  },
  {
    id: "travel", label: "How often are you away from home?",
    options: [
      ["0", "Rarely — I'm home most days"],
      ["4", "Long weekends now and then"],
      ["8", "A week or so most months"],
      ["14", "Often away for 2+ weeks"],
    ],
  },
  {
    id: "household", label: "Who else lives with you?",
    options: [
      ["none", "No pets or small children"],
      ["pets", "Cats or dogs"],
      ["kids", "Young children"],
      ["both", "Pets and young children"],
    ],
  },
  {
    id: "space", label: "How much space do you have for plants?",
    options: [
      ["S", "Just a desk or windowsill"],
      ["M", "Shelves and tabletops"],
      ["L", "Room for big floor plants too"],
    ],
  },
  {
    id: "humidity", label: "How humid is your home?",
    options: [
      ["1", "Dry — heating/AC runs a lot, or a dry climate"],
      ["2", "Average"],
      ["3", "Humid — a humid climate, a bathroom spot, or I own a humidifier"],
    ],
  },
  {
    id: "temp", label: "What's your home's usual temperature?",
    options: [
      ["cool", "Cool — often below 65°F (18°C)"],
      ["mild", "Comfortable — 65–75°F (18–24°C)"],
      ["warm", "Warm — often above 78°F (26°C)"],
    ],
  },
  {
    id: "style", label: "What look are you after?",
    options: [
      ["any", "Surprise me"],
      ["trailing", "Trailing and hanging plants"],
      ["statement", "Big, bold leaves"],
      ["compact", "Small and tidy"],
      ["flowering", "Flowers and color"],
      ["succulent", "Succulents and desert vibes"],
      ["edible", "Something I can cook with"],
    ],
  },
  {
    id: "count", label: "How many plants do you want to start with?",
    options: [
      ["2", "One or two"],
      ["4", "A small collection (3–5)"],
      ["6", "Make it a jungle (6+)"],
    ],
  },
];

export const DEFAULT_ANSWERS = {
  light: "3", time: "2", experience: "1", travel: "4", household: "none",
  space: "M", humidity: "2", temp: "mild", style: "any", count: "4",
};

const LIGHT_WORDS = { 1: "low light", 2: "medium light", 3: "bright indirect light", 4: "direct sun" };

export function capacity(a) {
  // Effort you can give, capped by what you know how to do (plus a little room to learn).
  return Math.max(1, Math.min(Number(a.time), Number(a.experience) + 1));
}

export function evaluate(p, a) {
  const light = Number(a.light);
  const cap = capacity(a);
  const away = Number(a.travel);
  const humid = Number(a.humidity);
  const reasons = [];
  const blockers = [];
  let score = 50;

  // Hard requirements
  if (p.light.min > light) blockers.push(`needs at least ${LIGHT_WORDS[p.light.min]}`);
  const noToxic = a.household !== "none";
  if (noToxic && !p.petSafe) blockers.push(a.household === "kids" ? "toxic if chewed by children" : "toxic to pets");
  if (a.temp === "cool" && p.temp.min >= 65) blockers.push(`needs at least ${p.temp.min}°F`);
  if (a.temp === "warm" && p.temp.max <= 75) blockers.push("prefers a cool room");
  if (a.space === "S" && p.size === "L") blockers.push("grows too big for a windowsill");

  // Light fit
  if (light >= p.light.min && light <= p.light.max) {
    score += 10;
    reasons.push(`Your ${LIGHT_WORDS[light]} is right in its comfort zone.`);
  } else if (light > p.light.max) {
    score -= 4;
    reasons.push(`Keep it back from your sunniest window — it prefers ${LIGHT_WORDS[p.light.max]}.`);
  }

  // Effort fit
  if (p.difficulty > cap) {
    score -= 18 * (p.difficulty - cap);
    reasons.push(`A step above your current care routine — expect a learning curve.`);
  } else {
    score += 12 - 3 * (cap - p.difficulty);
    if (p.difficulty === 1) reasons.push("Very forgiving if you miss a watering or two.");
    else if (p.difficulty === cap) reasons.push("Matches the time and experience you have.");
  }

  // Travel
  if (away > 0) {
    if (p.water.days[1] >= away) {
      score += 8;
      reasons.push(`Can go ${p.water.days[1]}+ days between waterings, so trips away are fine.`);
    } else {
      score -= Math.min(20, (away - p.water.days[1]) * 2);
      reasons.push(`Needs water every ${p.water.days[0]}–${p.water.days[1]} days — line up a plant-sitter or self-watering pot for trips.`);
    }
  }

  // Humidity
  if (p.humidity.level === 3 && humid === 1) {
    score -= 14;
    reasons.push("Your dry air will brown its leaves without a humidifier.");
  } else if (p.humidity.level === 3 && humid === 3) {
    score += 6;
    reasons.push("Your humid home is exactly what it craves.");
  } else if (p.humidity.level === 1 && humid === 1) {
    score += 5;
    reasons.push("Happy in dry air.");
  }

  // Style & space
  const tagMap = { trailing: "trailing", statement: "statement", compact: "compact", flowering: "flowering", succulent: "succulent", edible: "edible" };
  if (a.style !== "any" && p.tags.includes(tagMap[a.style])) {
    score += 14;
    reasons.push(styleReason(a.style));
  }
  if (a.space === "L" && p.size === "L") score += 4;
  if (a.space === "S" && p.size === "S") score += 5;

  if (noToxic && p.petSafe) reasons.push(a.household === "kids" ? "Non-toxic, so it's safe around little ones." : "Pet-safe (non-toxic to cats and dogs).");

  return { plant: p, score, ok: blockers.length === 0, blockers, reasons };
}

function styleReason(style) {
  return {
    trailing: "Trails beautifully from a shelf or hanging planter.",
    statement: "Big, bold foliage that anchors a room.",
    compact: "Stays small and tidy.",
    flowering: "Brings flowers and color.",
    succulent: "Sculptural, sun-loving succulent style.",
    edible: "You can cook with it.",
  }[style];
}

function pickDiverse(list, n, key = (r) => r.plant.category) {
  const out = [];
  const seen = new Set();
  for (const r of list) {
    if (out.length >= n) break;
    if (!seen.has(key(r))) {
      out.push(r);
      seen.add(key(r));
    }
  }
  for (const r of list) {
    if (out.length >= n) break;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

export function recommend(plants, a) {
  const n = Number(a.count);
  const cap = capacity(a);
  const evaluated = plants.map((p) => evaluate(p, a));
  const ok = evaluated.filter((r) => r.ok).sort((x, y) => y.score - x.score);
  const comfortable = ok.filter((r) => r.plant.difficulty <= cap);
  const bundles = [];

  bundles.push({
    title: "Your best match",
    why: "The highest-scoring plants for your light, schedule and space, mixed across different plant types so your home doesn't look like one plant on repeat.",
    picks: pickDiverse(comfortable.length >= n ? comfortable : ok, n),
  });

  const easiest = [...comfortable].sort((x, y) => x.plant.difficulty - y.plant.difficulty || y.score - x.score);
  bundles.push({
    title: "Easy wins",
    why: "The lowest-effort plants that still suit your home. Start here if you want early success and a quick confidence boost.",
    picks: pickDiverse(easiest, n),
  });

  if (a.style === "any") {
    const roles = [
      ["Hanging or shelf trailer", (r) => r.plant.tags.includes("trailing")],
      ["Statement floor plant", (r) => r.plant.size === "L" || r.plant.tags.includes("statement")],
      ["Desk or windowsill buddy", (r) => r.plant.size === "S" && !r.plant.tags.includes("trailing")],
      ["Bathroom or humid corner", (r) => r.plant.humidity.level >= 2 && r.plant.tags.includes("humid")],
      ["Something in bloom", (r) => r.plant.tags.includes("flowering")],
      ["Kitchen herb", (r) => r.plant.tags.includes("edible")],
    ];
    const picks = [];
    for (const [role, test] of roles) {
      if (picks.length >= Math.max(n, 3)) break;
      const hit = comfortable.find((r) => test(r) && !picks.some((x) => x.plant.slug === r.plant.slug));
      if (hit) picks.push({ ...hit, role });
    }
    bundles.push({
      title: "Room by room",
      why: "One plant for each kind of spot in a home — a hanging corner, a floor plant, a desk, a humid nook — so the whole place feels alive.",
      picks,
    });
  } else {
    const styled = ok.filter((r) => r.reasons.includes(styleReason(a.style)));
    bundles.push({
      title: `Your ${styleTitle(a.style)} collection`,
      why: `Plants that deliver the look you asked for and can live with your setup. Anything above your comfort level is labeled.`,
      picks: pickDiverse(styled, n, (r) => r.plant.slug),
    });
  }

  const stretch = ok.filter((r) => r.plant.difficulty === cap + 1).sort((x, y) => y.score - x.score)[0];
  const avoid = evaluated
    .filter((r) => !r.ok && r.plant.difficulty <= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, 4);

  return { bundles: bundles.filter((b) => b.picks.length), stretch, ranked: ok, avoid, cap };
}

function styleTitle(style) {
  return { trailing: "trailing", statement: "big-leaf", compact: "small-space", flowering: "flowering", succulent: "succulent", edible: "kitchen garden" }[style];
}

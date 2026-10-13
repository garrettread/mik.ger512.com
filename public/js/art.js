// Flat, simple-colored plant illustrations: hanging vines, big leaves, rosettes and fronds. No pots.

const C = {
  olive: "#4b5a32",
  oliveDeep: "#36421f",
  sage: "#7f8f5c",
  moss: "#a3ad80",
  clay: "#b5836f",
  rose: "#cf9f8f",
  sand: "#e3d4b8",
};

const teardrop = "M0 0 C -9 -7 -11 -18 0 -24 C 11 -18 9 -7 0 0 Z";
const heart = "M0 0 C -12 -8 -14 -20 -5 -24 C -2 -25 0 -22 0 -20 C 0 -22 2 -25 5 -24 C 14 -20 12 -8 0 0 Z";

export function vine({ x = 50, length = 160, sway = 10, color = C.olive, leaf = C.sage, shape = heart, scale = 1, seed = 1 } = {}) {
  const pts = [];
  const steps = Math.max(4, Math.round(length / 22));
  let d = `M${x} 0`;
  for (let i = 1; i <= steps; i++) {
    const y = (length / steps) * i;
    const cx = x + Math.sin((i + seed) * 1.3) * sway;
    d += ` Q ${x + Math.sin((i + seed) * 1.3 - 0.6) * sway * 1.4} ${y - length / steps / 2} ${cx} ${y}`;
    pts.push([cx, y, i]);
  }
  const leaves = pts
    .map(([lx, ly, i]) => {
      const side = i % 2 ? 1 : -1;
      const rot = side * (55 + ((i * 17 + seed * 7) % 30));
      const s = scale * (0.75 + ((i * 13 + seed) % 5) * 0.08);
      const fill = i % 3 === 0 ? color : leaf;
      return `<path d="${shape}" fill="${fill}" transform="translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(${rot}) scale(${s.toFixed(2)})"/>`;
    })
    .join("");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>${leaves}`;
}

let clipId = 0;

export function bigLeaf({ x = 0, y = 0, rot = 0, scale = 1, color = C.olive, vein = C.moss, split = false } = {}) {
  const veins = [20, 38, 56, 72]
    .map((v) => `<path d="M0 ${-v} q ${14 + v * 0.15} ${-8} ${24 + v * 0.1} ${-14}" stroke="${vein}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
       <path d="M0 ${-v} q ${-(14 + v * 0.15)} ${-8} ${-(24 + v * 0.1)} ${-14}" stroke="${vein}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)
    .join("");
  const cuts = split
    ? [30, 52, 74].map((v) => `<path d="M${30 - v * 0.05} ${-v} l -14 -4 l 14 -5 Z M${-30 + v * 0.05} ${-v} l 14 -4 l -14 -5 Z" fill="var(--bg, #f6f0e3)"/>`).join("")
    : "";
  const id = `leafclip${++clipId}`;
  const shape = "M0 0 C 38 -12 52 -62 0 -108 C -52 -62 -38 -12 0 0 Z";
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <clipPath id="${id}"><path d="${shape}"/></clipPath>
    <path d="M0 18 L0 0" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <path d="${shape}" fill="${color}"/>
    <g clip-path="url(#${id})">
      <path d="M0 0 L0 -100" stroke="${vein}" stroke-width="1.6" stroke-linecap="round"/>
      ${veins}
    </g>
    ${cuts}
  </g>`;
}

function rosette(color, accent) {
  const petals = Array.from({ length: 10 }, (_, i) => {
    const r = i * 36 + (i % 2) * 18;
    const s = i < 5 ? 1 : 0.7;
    return `<ellipse cx="0" cy="-18" rx="8" ry="18" fill="${i < 5 ? color : accent}" transform="rotate(${r}) scale(${s})"/>`;
  }).join("");
  return `<g transform="translate(60 62) scale(1.55)">${petals}<circle r="5" fill="${accent}"/></g>`;
}

function frond(color, accent) {
  const fr = (rot, len) => {
    const leaflets = Array.from({ length: Math.round(len / 9) }, (_, i) => {
      const y = -10 - i * 9;
      const w = 14 - i * (10 / (len / 9));
      return `<path d="M0 ${y} q ${w} -2 ${w + 4} -9 q -${w * 0.6} 3 -${w + 4} 9 Z M0 ${y} q -${w} -2 -${w + 4} -9 q ${w * 0.6} 3 ${w + 4} 9 Z" fill="${i % 2 ? color : accent}"/>`;
    }).join("");
    return `<g transform="rotate(${rot})"><path d="M0 0 L0 ${-len}" stroke="${color}" stroke-width="1.5"/>${leaflets}</g>`;
  };
  return `<g transform="translate(60 112)">${fr(-38, 80)}${fr(0, 95)}${fr(36, 80)}</g>`;
}

function tall(color, accent) {
  const blades = [-14, -6, 0, 7, 15]
    .map((r, i) => `<path d="M0 0 C ${r - 6} -40 ${r * 2 - 6} -70 ${r * 2.2} -${88 + (i % 2) * 10} C ${r * 2 + 6} -70 ${r + 6} -40 0 0 Z" fill="${i % 2 ? accent : color}"/>`)
    .join("");
  return `<g transform="translate(60 112)">${blades}</g>`;
}

function bloom(color, accent) {
  return `${bigLeaf({ x: 50, y: 110, rot: -22, scale: 0.6, color })}${bigLeaf({ x: 72, y: 110, rot: 25, scale: 0.55, color: C.sage, vein: C.moss })}
    <g transform="translate(64 38)">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-9" rx="7" ry="10" fill="${accent}" transform="rotate(${r})"/>`).join("")}<circle r="4.5" fill="${C.sand}"/></g>
    <path d="M64 46 Q 62 70 60 104" stroke="${color}" stroke-width="2" fill="none"/>`;
}

const PALETTES = [
  [C.olive, C.sage],
  [C.oliveDeep, C.moss],
  [C.sage, C.olive],
  [C.olive, C.clay],
];

// Pick an illustration that matches the plant's growth habit.
export function plantArt(p, { size = 120 } = {}) {
  const idx = [...p.slug].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const [color, accent] = PALETTES[idx % PALETTES.length];
  const cat = p.category.toLowerCase();
  let inner;
  if (p.tags.includes("trailing")) {
    inner = `<path d="M15 4 H105" stroke="${C.sand}" stroke-width="3" stroke-linecap="round"/>
      ${vine({ x: 38, length: 105, sway: 6, color, leaf: accent, seed: idx, scale: 0.75, shape: cat.includes("succulent") ? "M0 0 a6 6 0 1 0 0.1 0Z" : heart })}
      ${vine({ x: 62, length: 80, sway: 5, color, leaf: accent, seed: idx + 3, scale: 0.7, shape: cat.includes("succulent") ? "M0 0 a6 6 0 1 0 0.1 0Z" : heart })}
      ${vine({ x: 84, length: 95, sway: 6, color, leaf: accent, seed: idx + 5, scale: 0.75, shape: cat.includes("succulent") ? "M0 0 a6 6 0 1 0 0.1 0Z" : heart })}`;
  } else if (cat.includes("herb") || /snake|sansevieria|yucca|dracaena|corn-plant|spider-plant|lucky-bamboo/.test(p.slug)) {
    inner = tall(color, accent === C.clay ? C.sage : accent);
  } else if (cat.includes("succulent") || cat.includes("cactus")) {
    inner = rosette(color, accent === C.clay ? C.rose : accent);
  } else if (cat.includes("fern") || cat.includes("palm")) {
    inner = frond(color, accent === C.clay ? C.sage : accent);
  } else if (p.tags.includes("flowering") || cat.includes("flowering")) {
    inner = bloom(color, C.rose);
  } else {
    inner = `${bigLeaf({ x: 58, y: 112, rot: -18, scale: 0.85, color, vein: C.moss, split: p.slug.includes("monstera") })}
      ${bigLeaf({ x: 66, y: 114, rot: 26, scale: 0.62, color: accent === C.clay ? C.sage : accent, vein: C.sand })}`;
  }
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}

// Hanging vines and big leaves framing the hero banner.
export function heroArt() {
  return `<svg class="hero-art" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    ${vine({ x: 70, length: 300, sway: 14, color: C.oliveDeep, leaf: C.olive, seed: 2, scale: 1.25 })}
    ${vine({ x: 150, length: 200, sway: 10, color: C.olive, leaf: C.sage, seed: 5, scale: 1.1 })}
    ${vine({ x: 230, length: 120, sway: 8, color: C.olive, leaf: C.moss, seed: 8, scale: 0.95 })}
    ${vine({ x: 1130, length: 330, sway: 14, color: C.oliveDeep, leaf: C.olive, seed: 3, scale: 1.25 })}
    ${vine({ x: 1050, length: 220, sway: 10, color: C.olive, leaf: C.sage, seed: 9, scale: 1.1 })}
    ${vine({ x: 975, length: 140, sway: 8, color: C.clay, leaf: C.rose, seed: 4, scale: 0.9 })}
    ${bigLeaf({ x: 1180, y: 470, rot: -40, scale: 2.3, color: C.olive, vein: C.sage, split: true })}
    ${bigLeaf({ x: 1110, y: 480, rot: -12, scale: 1.6, color: C.sage, vein: C.moss })}
    ${bigLeaf({ x: 20, y: 470, rot: 38, scale: 2.0, color: C.clay, vein: C.rose })}
  </svg>`;
}

export function sprigIcon(size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 22 V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12 C 4 12 3 5 4 3 C 9 3 12 6 12 12 Z" fill="currentColor"/><path d="M12 15 C 19 15 21 9 20 7 C 15 7 12 10 12 15 Z" fill="currentColor" opacity=".7"/></svg>`;
}

export function levelLeaves(level) {
  return `<span class="level-leaves" aria-label="Level ${level} of 4">${[1, 2, 3, 4]
    .map((i) => `<svg viewBox="0 0 12 16" width="10" height="13" class="${i <= level ? "on" : ""}"><path d="M6 16 C -1 10 0 3 6 0 C 12 3 13 10 6 16 Z"/></svg>`)
    .join("")}</span>`;
}

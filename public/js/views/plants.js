import { loadPlants, LEVELS, LIGHT, HUMIDITY, SIZE, esc, lightRange, waterLabel, fToC, api, toast } from "../util.js";
import { plantArt, levelLeaves } from "../art.js";
import { addPlantModal } from "./garden.js";

export function plantCard(p) {
  return `
    <a class="plant-card" href="/plants/${p.slug}">
      <div class="plant-card-art">${plantArt(p, { size: 110 })}</div>
      <div class="plant-card-body">
        <div class="plant-card-top">${levelLeaves(p.difficulty)}<span class="level-name">${LEVELS[p.difficulty].name}</span></div>
        <h3>${esc(p.name)}</h3>
        <p class="botanical">${esc(p.botanical)}</p>
        <ul class="chips">
          <li>${esc(LIGHT[p.light.min])}${p.light.max > p.light.min ? "+" : ""}</li>
          <li>${esc(waterLabel(p))}</li>
          ${p.petSafe ? `<li class="chip-safe">Pet-safe</li>` : ""}
        </ul>
      </div>
    </a>`;
}

export async function catalogView(el) {
  const plants = await loadPlants();
  el.innerHTML = `
    <section class="page">
      <div class="page-head">
        <h1>Plant guide</h1>
        <p>${plants.length} common houseplants, sorted by how much care they need.</p>
      </div>
      <form class="filters" onsubmit="return false">
        <input type="search" name="q" placeholder="Search by name…" aria-label="Search plants">
        <select name="light" aria-label="Light">
          <option value="">Any light</option>
          ${[1, 2, 3, 4].map((l) => `<option value="${l}">Works in ${LIGHT[l].toLowerCase()}</option>`).join("")}
        </select>
        <select name="style" aria-label="Style">
          <option value="">Any style</option>
          <option value="trailing">Trailing / hanging</option>
          <option value="statement">Big statement leaves</option>
          <option value="compact">Small &amp; tidy</option>
          <option value="flowering">Flowering</option>
          <option value="succulent">Succulents &amp; cacti</option>
          <option value="edible">Herbs &amp; edibles</option>
        </select>
        <select name="size" aria-label="Size">
          <option value="">Any size</option>
          ${Object.entries(SIZE).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
        </select>
        <label class="check"><input type="checkbox" name="pet"> Pet-safe only</label>
      </form>
      <nav class="level-jump">${[1, 2, 3, 4].map((l) => `<a href="#level-${l}">${levelLeaves(l)} ${LEVELS[l].name}</a>`).join("")}</nav>
      <div class="catalog"></div>
    </section>`;

  const form = el.querySelector(".filters");
  const out = el.querySelector(".catalog");

  function draw() {
    const f = Object.fromEntries(new FormData(form));
    const q = (f.q || "").toLowerCase().trim();
    const list = plants.filter((p) => {
      if (q && ![p.name, p.botanical, ...p.aka].some((s) => s.toLowerCase().includes(q))) return false;
      if (f.light && !(p.light.min <= +f.light && +f.light <= p.light.max)) return false;
      if (f.style && !p.tags.includes(f.style)) return false;
      if (f.size && p.size !== f.size) return false;
      if (f.pet && !p.petSafe) return false;
      return true;
    });
    out.innerHTML =
      [1, 2, 3, 4]
        .map((l) => {
          const items = list.filter((p) => p.difficulty === l).sort((a, b) => a.name.localeCompare(b.name));
          if (!items.length) return "";
          return `
            <section class="level-section" id="level-${l}">
              <header>
                <h2>${levelLeaves(l)} Level ${l} · ${LEVELS[l].name}</h2>
                <p>${LEVELS[l].blurb} <span class="meta">${LEVELS[l].attention}.</span></p>
              </header>
              <div class="card-grid">${items.map(plantCard).join("")}</div>
            </section>`;
        })
        .join("") || `<p class="empty">No plants match those filters.</p>`;
  }

  form.addEventListener("input", draw);
  draw();
  if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 0);
  el.querySelector(".level-jump").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
  });
}

export async function plantView(el, [slug], { state, setTitle }) {
  const plants = await loadPlants();
  const p = plants.find((x) => x.slug === slug);
  if (!p) throw new Error("We don't have a guide for that plant yet.");
  setTitle(p.name);

  const fact = (label, value, sub = "") => `<div class="fact"><span class="fact-label">${label}</span><span class="fact-value">${value}</span>${sub ? `<span class="fact-sub">${sub}</span>` : ""}</div>`;
  const similar = plants
    .filter((x) => x.slug !== p.slug && x.difficulty === p.difficulty && (x.category === p.category || x.tags.some((t) => p.tags.includes(t))))
    .slice(0, 4);

  el.innerHTML = `
    <article class="page plant-detail">
      <a class="back" href="/plants">← Plant guide</a>
      <header class="plant-hero">
        <div class="plant-hero-art">${plantArt(p, { size: 220 })}</div>
        <div>
          <span class="level-badge level-${p.difficulty}">${levelLeaves(p.difficulty)} Level ${p.difficulty} · ${LEVELS[p.difficulty].name}</span>
          <h1>${esc(p.name)}</h1>
          <p class="botanical">${esc(p.botanical)}${p.aka.length ? ` · also called ${p.aka.map(esc).join(", ")}` : ""}</p>
          <p class="why">${esc(p.why)}</p>
          <div class="hero-actions">
            ${state.user ? `<button class="btn add-garden">Add to my garden</button>` : `<a class="btn" href="/signup">Sign up to track this plant</a>`}
          </div>
        </div>
      </header>

      <div class="facts">
        ${fact("Light", esc(lightRange(p)))}
        ${fact("Water", esc(waterLabel(p)), "in spring & summer")}
        ${fact("Humidity", esc(HUMIDITY[p.humidity.level]))}
        ${fact("Temperature", `${p.temp.min}–${p.temp.max}°F`, `${fToC(p.temp.min)}–${fToC(p.temp.max)}°C`)}
        ${fact("Pets", p.petSafe ? "Non-toxic" : "Toxic if eaten", p.petSafe ? "Safe for cats & dogs" : "Keep away from pets & kids")}
        ${fact("Size · growth", `${SIZE[p.size]} · ${esc(p.growth)}`)}
      </div>

      <div class="care-grid">
        <section class="care-block wide">
          <h2>Watering</h2>
          <p>${esc(p.water.text)}</p>
          <p><strong>How much:</strong> ${esc(p.water.amount)}</p>
          <p class="muted">Water about half as often in fall and winter, when growth slows.</p>
        </section>
        <section class="care-block"><h2>Light</h2><p>${esc(p.light.text)}</p></section>
        <section class="care-block"><h2>Humidity</h2><p>${esc(p.humidity.text)}</p></section>
        <section class="care-block"><h2>Climate</h2><p>${esc(p.climate)}</p></section>
        <section class="care-block"><h2>Indoor or outdoor</h2><p>${esc(p.placement)}</p></section>
        <section class="care-block"><h2>Soil</h2><p>${esc(p.soil)}</p></section>
        <section class="care-block"><h2>Feeding</h2><p>${esc(p.fertilizer)}</p></section>
        <section class="care-block"><h2>Propagation</h2><p>${esc(p.propagation)}</p></section>
        <section class="care-block"><h2>Watch out for</h2><ul>${p.problems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
        <section class="care-block tip wide"><h2>Grower's tip</h2><p>${esc(p.tip)}</p></section>
      </div>

      ${similar.length ? `<section class="similar"><h2>Similar level-${p.difficulty} plants</h2><div class="card-grid">${similar.map(plantCard).join("")}</div></section>` : ""}
    </article>`;

  el.querySelector(".add-garden")?.addEventListener("click", () =>
    addPlantModal(plants, p.slug, async (payload) => {
      await api("/garden", { method: "POST", body: payload });
      toast(`${p.name} added to your garden`);
    })
  );
}

import { loadPlants, LEVELS, esc } from "../util.js";
import { heroArt, levelLeaves } from "../art.js";
import { plantCard } from "./plants.js";

export async function homeView(el, _params, { state }) {
  const plants = await loadPlants();
  const counts = [1, 2, 3, 4].map((l) => plants.filter((p) => p.difficulty === l).length);
  const featured = ["golden-pothos", "monstera-deliciosa", "prayer-plant", "calathea"]
    .map((s) => plants.find((p) => p.slug === s))
    .filter(Boolean);

  el.innerHTML = `
    <section class="hero">
      ${heroArt()}
      <div class="hero-inner">
        <p class="eyebrow">Houseplant care, made personal</p>
        <h1>Grow the plants that fit your life.</h1>
        <p class="lede">Detailed care guides for ${plants.length} common houseplants, recommendations matched to your light, schedule and home, and a garden journal to keep every plant thriving.</p>
        <div class="hero-actions">
          <a class="btn btn-clay" href="/match">Find my plants</a>
          <a class="btn btn-ghost" href="/plants">Browse the guide</a>
        </div>
      </div>
    </section>

    <section class="page">
      <div class="section-head">
        <h2>Four levels of care</h2>
        <p>Every plant is sorted by how much attention it needs to stay healthy.</p>
      </div>
      <div class="level-grid">
        ${[1, 2, 3, 4]
          .map(
            (l) => `
          <a class="level-card level-${l}" href="/plants#level-${l}">
            ${levelLeaves(l)}
            <h3>Level ${l} · ${LEVELS[l].name}</h3>
            <p>${LEVELS[l].blurb}</p>
            <span class="meta">${counts[l - 1]} plants · ${LEVELS[l].attention}</span>
          </a>`
          )
          .join("")}
      </div>
    </section>

    <section class="page band">
      <div class="steps">
        <div><span class="step-num">1</span><h3>Tell us about your home</h3><p>Light, schedule, travel, pets, space and style.</p></div>
        <div><span class="step-num">2</span><h3>Get plant combinations</h3><p>Sets of plants that work together, with the reasons why.</p></div>
        <div><span class="step-num">3</span><h3>Log your care</h3><p>Track watering, feeding and repotting for each plant you own.</p></div>
        <div><span class="step-num">4</span><h3>Keep your streak</h3><p>Log daily, follow friends and see how their gardens grow.</p></div>
      </div>
      ${state.user ? `<p class="center"><a class="btn" href="/garden">Go to my garden</a></p>` : `<p class="center"><a class="btn" href="/signup">Create a free account</a></p>`}
    </section>

    <section class="page">
      <div class="section-head">
        <h2>A few favorites</h2>
        <p>One from each level.</p>
      </div>
      <div class="card-grid">${featured.map(plantCard).join("")}</div>
      <p class="center"><a href="/plants">See all ${esc(plants.length)} plants →</a></p>
    </section>`;
}

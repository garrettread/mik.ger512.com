import { loadPlants, LEVELS, esc, lightRange, waterLabel } from "../util.js";
import { plantArt, levelLeaves } from "../art.js";
import { QUESTIONS, DEFAULT_ANSWERS, recommend } from "../match.js";

const STORE = "mik.match.answers";

function savedAnswers() {
  try {
    return { ...DEFAULT_ANSWERS, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch {
    return { ...DEFAULT_ANSWERS };
  }
}

function pickCard(r) {
  const p = r.plant;
  return `
    <a class="pick" href="/plants/${p.slug}">
      <div class="pick-art">${plantArt(p, { size: 84 })}</div>
      <div class="pick-body">
        ${r.role ? `<span class="pick-role">${esc(r.role)}</span>` : ""}
        <h4>${esc(p.name)}</h4>
        <div class="pick-meta">${levelLeaves(p.difficulty)} ${LEVELS[p.difficulty].name} · ${esc(waterLabel(p))}</div>
        <ul class="reasons">${r.reasons.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </a>`;
}

export async function matchView(el) {
  const plants = await loadPlants();
  const answers = savedAnswers();

  el.innerHTML = `
    <section class="page">
      <div class="page-head">
        <h1>Find your plants</h1>
        <p>Tell us about your home and routine. We'll suggest combinations of plants that will actually thrive with you, and explain why.</p>
      </div>
      <div class="match-layout">
        <form class="match-form card">
          ${QUESTIONS.map(
            (q) => `
            <label class="field">
              <span>${esc(q.label)}</span>
              <select name="${q.id}">
                ${q.options.map(([v, t]) => `<option value="${v}" ${answers[q.id] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}
              </select>
            </label>`
          ).join("")}
          <button class="btn btn-block" type="submit">Show my plants</button>
        </form>
        <div class="match-results" aria-live="polite"></div>
      </div>
    </section>`;

  const form = el.querySelector("form");
  const out = el.querySelector(".match-results");

  function run(scroll) {
    const a = Object.fromEntries(new FormData(form));
    try {
      localStorage.setItem(STORE, JSON.stringify(a));
    } catch {}
    const { bundles, stretch, ranked, avoid, cap } = recommend(plants, a);

    out.innerHTML = `
      <div class="summary card">
        <h2>Your care level: ${levelLeaves(cap)} ${LEVELS[cap].name}</h2>
        <p>Based on your time and experience, plants up to <strong>level ${cap}</strong> should be comfortable. ${ranked.length} of ${plants.length} plants work in your home.</p>
      </div>
      ${
        bundles.length
          ? bundles
              .map(
                (b) => `
        <section class="bundle">
          <h3>${esc(b.title)}</h3>
          <p class="bundle-why">${esc(b.why)}</p>
          <div class="picks">${b.picks.map(pickCard).join("")}</div>
        </section>`
              )
              .join("")
          : `<p class="empty card">No plants fit every condition. Try a brighter spot or a different style.</p>`
      }
      ${
        stretch
          ? `<section class="bundle stretch">
              <h3>Ready for a challenge?</h3>
              <p class="bundle-why">Once your first plants are thriving, this is a good next step up to level ${stretch.plant.difficulty}.</p>
              <div class="picks">${pickCard(stretch)}</div>
            </section>`
          : ""
      }
      ${
        avoid.length
          ? `<section class="bundle avoid">
              <h3>Popular plants to skip for now</h3>
              <ul class="avoid-list">${avoid
                .map((r) => `<li><a href="/plants/${r.plant.slug}">${esc(r.plant.name)}</a> — ${esc(r.blockers.join("; "))}.</li>`)
                .join("")}</ul>
            </section>`
          : ""
      }
      <details class="ranked card">
        <summary>All ${ranked.length} plants that work for you, best first</summary>
        <ol>${ranked
          .map((r) => `<li><a href="/plants/${r.plant.slug}">${esc(r.plant.name)}</a> <span class="muted">· level ${r.plant.difficulty} · ${esc(lightRange(r.plant))}</span></li>`)
          .join("")}</ol>
      </details>`;
    if (scroll) out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(window.innerWidth < 900);
  });
  form.addEventListener("change", () => run(false));
  run(false);
}

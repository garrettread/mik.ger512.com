import { api, esc, loadPlants, plantMap, LEVELS, ACTIONS, localToday, daysBetween, relDay, fmtDate, waterLabel, toast, modal } from "../util.js";
import { plantArt, levelLeaves } from "../art.js";

export function addPlantModal(plants, preselect, onSave, existing) {
  const sorted = [...plants].sort((a, b) => a.name.localeCompare(b.name));
  modal(
    `<h2>${existing ? "Edit plant" : "Add a plant to your garden"}</h2>
     <form class="stack">
       <label class="field"><span>Plant</span>
         <select name="plantSlug" required>
           <option value="">Choose a plant…</option>
           ${sorted.map((p) => `<option value="${p.slug}" ${p.slug === (existing?.plantSlug || preselect) ? "selected" : ""}>${esc(p.name)} (${esc(p.botanical)})</option>`).join("")}
         </select>
       </label>
       <label class="field"><span>Nickname <small>optional</small></span><input name="nickname" maxlength="60" value="${esc(existing?.nickname || "")}" placeholder="e.g. Big Monty"></label>
       <label class="field"><span>Where it lives <small>optional</small></span><input name="location" maxlength="60" value="${esc(existing?.location || "")}" placeholder="e.g. Living room, east window"></label>
       <label class="field"><span>Date you got it <small>optional</small></span><input name="acquiredOn" type="date" max="${localToday()}" value="${esc(existing?.acquiredOn || "")}"></label>
       <label class="field"><span>Notes <small>optional</small></span><textarea name="notes" maxlength="1000" rows="3">${esc(existing?.notes || "")}</textarea></label>
       <p class="form-error" role="alert" hidden></p>
       <button class="btn btn-block" type="submit">${existing ? "Save changes" : "Add plant"}</button>
     </form>`,
    (box, close) => {
      const form = box.querySelector("form");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        if (!data.plantSlug) return;
        try {
          await onSave({ ...data, acquiredOn: data.acquiredOn || null });
          close();
        } catch (ex) {
          const err = form.querySelector(".form-error");
          err.textContent = ex.message;
          err.hidden = false;
        }
      });
    }
  );
}

function waterStatus(p, gp) {
  if (!gp.lastWatered) return { cls: "unknown", text: "No watering logged yet" };
  const since = daysBetween(gp.lastWatered, localToday());
  const [min, max] = p.water.days;
  if (since > max) return { cls: "overdue", text: `Watered ${relDay(gp.lastWatered)} — probably thirsty` };
  if (since >= min) return { cls: "due", text: `Watered ${relDay(gp.lastWatered)} — check the soil` };
  return { cls: "ok", text: `Watered ${relDay(gp.lastWatered)} · next check in ~${min - since} day${min - since === 1 ? "" : "s"}` };
}

export function streakBanner(streak) {
  const msg = streak.loggedToday
    ? "You've logged today. Nice."
    : streak.current
      ? "Log any care today to keep it going."
      : "Log any plant care to start a streak.";
  return `
    <div class="streak-banner ${streak.loggedToday ? "done" : ""}">
      <div class="streak-num"><strong>${streak.current}</strong><span>day streak</span></div>
      <div><p>${msg}</p><p class="muted">Longest: ${streak.longest} day${streak.longest === 1 ? "" : "s"}</p></div>
    </div>`;
}

async function quickLog(id, actions) {
  return api(`/garden/${id}/logs`, { method: "POST", body: { actions, today: localToday() } });
}

export async function gardenView(el, _p, { state, navigate }) {
  const [plants, byslug, { plants: mine }, prof] = await Promise.all([
    loadPlants(),
    plantMap(),
    api("/garden"),
    api(`/users/${encodeURIComponent(state.user.username)}?today=${localToday()}`),
  ]);

  const card = (gp) => {
    const p = byslug[gp.plantSlug];
    if (!p) return "";
    const s = waterStatus(p, gp);
    return `
      <article class="garden-card">
        <a class="garden-card-link" href="/garden/${gp.id}">
          <div class="garden-art">${plantArt(p, { size: 96 })}</div>
          <div>
            <h3>${esc(gp.nickname || p.name)}</h3>
            <p class="muted">${gp.nickname ? esc(p.name) + " · " : ""}${esc(gp.location || "No spot set")}</p>
            <p class="water-status ${s.cls}">${esc(s.text)}</p>
            <p class="muted small">${levelLeaves(p.difficulty)} ${esc(waterLabel(p))} · ${gp.logCount} log${gp.logCount === 1 ? "" : "s"}</p>
          </div>
        </a>
        <div class="garden-card-actions">
          <button class="btn btn-small quick" data-id="${gp.id}" data-action="watered">Watered today</button>
          <a class="btn btn-small btn-ghost" href="/garden/${gp.id}">Log care</a>
        </div>
      </article>`;
  };

  el.innerHTML = `
    <section class="page">
      <div class="page-head row">
        <div>
          <h1>My garden</h1>
          <p>${mine.length ? `${mine.length} plant${mine.length === 1 ? "" : "s"} in your care.` : "Add the plants you already own to start logging their care."}</p>
        </div>
        <button class="btn add">+ Add a plant</button>
      </div>
      <div class="streak-slot">${streakBanner(prof.streak)}</div>
      ${
        mine.length
          ? `<div class="garden-grid">${mine.map(card).join("")}</div>`
          : `<div class="empty card"><p>Your garden is empty.</p><p><button class="btn add">Add your first plant</button> or <a href="/match">find plants that fit your home</a>.</p></div>`
      }
    </section>`;

  el.querySelectorAll(".add").forEach((b) =>
    b.addEventListener("click", () =>
      addPlantModal(plants, null, async (payload) => {
        const { plant } = await api("/garden", { method: "POST", body: payload });
        toast("Plant added");
        navigate(`/garden/${plant.id}`);
      })
    )
  );

  el.addEventListener("click", async (e) => {
    const b = e.target.closest(".quick");
    if (!b) return;
    b.disabled = true;
    try {
      const { streak } = await quickLog(b.dataset.id, [b.dataset.action]);
      toast("Logged: watered");
      el.querySelector(".streak-slot").innerHTML = streakBanner(streak);
      const status = b.closest(".garden-card").querySelector(".water-status");
      status.className = "water-status ok";
      status.textContent = "Watered today";
    } catch (ex) {
      toast(ex.message);
      b.disabled = false;
    }
  });
}

export async function gardenPlantView(el, [id], { navigate, setTitle }) {
  const [plants, byslug, data] = await Promise.all([loadPlants(), plantMap(), api(`/garden/${id}/logs`)]);
  let gp = data.plant;
  let logs = data.logs;
  const p = byslug[gp.plantSlug];
  setTitle(gp.nickname || p.name);
  const today = localToday();

  function timeline() {
    if (!logs.length) return `<p class="muted">No care logged yet. Your first entry starts the timeline.</p>`;
    const groups = {};
    for (const l of logs) (groups[l.loggedOn] ||= []).push(l);
    return Object.entries(groups)
      .map(
        ([day, items]) => `
        <li class="tl-day">
          <span class="tl-date">${esc(fmtDate(day))}</span>
          <ul>${items
            .map(
              (l) => `<li class="tl-item"><span class="tag tag-${esc(l.action)}">${esc(ACTIONS[l.action] || l.action)}</span>${l.notes ? `<span class="tl-note">${esc(l.notes)}</span>` : ""}<button class="link-btn del-log" data-id="${l.id}" aria-label="Delete entry">Delete</button></li>`
            )
            .join("")}</ul>
        </li>`
      )
      .join("");
  }

  const lastWater = logs.find((l) => l.action === "watered");

  el.innerHTML = `
    <section class="page">
      <a class="back" href="/garden">← My garden</a>
      <header class="gp-head">
        <div class="garden-art lg">${plantArt(p, { size: 150 })}</div>
        <div>
          <h1>${esc(gp.nickname || p.name)}</h1>
          <p class="muted">${gp.nickname ? `<a href="/plants/${p.slug}">${esc(p.name)}</a> · ` : `<a href="/plants/${p.slug}">Care guide</a> · `}${esc(gp.location || "No spot set")}${gp.acquiredOn ? ` · since ${esc(fmtDate(gp.acquiredOn))}` : ""}</p>
          <p class="pill-row"><span class="level-badge level-${p.difficulty}">${levelLeaves(p.difficulty)} ${LEVELS[p.difficulty].name}</span><span class="pill">Water ${esc(waterLabel(p).toLowerCase())}</span><span class="pill last-water">Last watered: ${esc(lastWater ? relDay(lastWater.loggedOn) : "not logged")}</span></p>
          ${gp.notes ? `<p class="gp-notes">${esc(gp.notes)}</p>` : ""}
          <div class="row-actions"><button class="btn btn-small btn-ghost edit">Edit</button><button class="btn btn-small btn-ghost danger remove">Remove</button></div>
        </div>
      </header>

      <div class="gp-layout">
        <form class="card log-form">
          <h2>Log care</h2>
          <fieldset class="action-chips">
            <legend>What did you do?</legend>
            ${Object.entries(ACTIONS)
              .map(([k, v]) => `<label class="chip-check"><input type="checkbox" name="actions" value="${k}" ${k === "watered" ? "checked" : ""}><span>${esc(v)}</span></label>`)
              .join("")}
          </fieldset>
          <label class="field"><span>When</span><input type="date" name="loggedOn" value="${today}" max="${today}"></label>
          <label class="field"><span>Notes <small>optional</small></span><textarea name="notes" rows="3" maxlength="500" placeholder="e.g. Soil was bone dry, new leaf unfurling"></textarea></label>
          <p class="form-error" role="alert" hidden></p>
          <button class="btn btn-block" type="submit">Save entry</button>
        </form>
        <div class="card">
          <h2>Care history</h2>
          <ul class="timeline">${timeline()}</ul>
        </div>
      </div>

      <aside class="card quick-guide">
        <h2>Quick care guide</h2>
        <p><strong>Water:</strong> ${esc(p.water.text)}</p>
        <p><strong>Light:</strong> ${esc(p.light.text)}</p>
        <p><strong>Feeding:</strong> ${esc(p.fertilizer)}</p>
        <p><a href="/plants/${p.slug}">Full ${esc(p.name)} guide →</a></p>
      </aside>
    </section>`;

  const form = el.querySelector(".log-form");
  const tl = el.querySelector(".timeline");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const actions = fd.getAll("actions");
    const err = form.querySelector(".form-error");
    err.hidden = true;
    if (!actions.length) {
      err.textContent = "Pick at least one thing you did.";
      err.hidden = false;
      return;
    }
    try {
      const res = await api(`/garden/${id}/logs`, {
        method: "POST",
        body: { actions, notes: fd.get("notes"), loggedOn: fd.get("loggedOn"), today: localToday() },
      });
      logs = [...res.logs, ...logs].sort((a, b) => (b.loggedOn + b.createdAt).localeCompare(a.loggedOn + a.createdAt));
      tl.innerHTML = timeline();
      const watered = logs.find((l) => l.action === "watered");
      if (watered) el.querySelector(".last-water").textContent = `Last watered: ${relDay(watered.loggedOn)}`;
      form.querySelector("textarea").value = "";
      toast(res.streak.current > 1 ? `Logged · ${res.streak.current}-day streak` : "Logged");
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  tl.addEventListener("click", async (e) => {
    const b = e.target.closest(".del-log");
    if (!b) return;
    await api(`/logs/${b.dataset.id}`, { method: "DELETE" });
    logs = logs.filter((l) => String(l.id) !== b.dataset.id);
    tl.innerHTML = timeline();
  });

  el.querySelector(".edit").addEventListener("click", () =>
    addPlantModal(
      plants,
      null,
      async (payload) => {
        ({ plant: gp } = await api(`/garden/${id}`, { method: "PATCH", body: payload }));
        toast("Saved");
        navigate(`/garden/${id}`, { replace: true });
      },
      gp
    )
  );

  el.querySelector(".remove").addEventListener("click", () =>
    modal(
      `<h2>Remove ${esc(gp.nickname || p.name)}?</h2><p>This deletes the plant and all ${logs.length} care log entries. It can't be undone.</p>
       <div class="row-actions"><button class="btn danger-fill confirm">Remove plant</button><button class="btn btn-ghost cancel">Keep it</button></div>`,
      (box, close) => {
        box.querySelector(".cancel").addEventListener("click", close);
        box.querySelector(".confirm").addEventListener("click", async () => {
          await api(`/garden/${id}`, { method: "DELETE" });
          close();
          toast("Plant removed");
          navigate("/garden");
        });
      }
    )
  );
}

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function relDay(iso) {
  if (!iso) return "never";
  const n = daysBetween(iso, localToday());
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 30) return `${n} days ago`;
  return fmtDate(iso);
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let plantsPromise;
export function loadPlants() {
  plantsPromise ??= fetch("/data/plants.json").then((r) => r.json());
  return plantsPromise;
}

export async function plantMap() {
  const list = await loadPlants();
  return Object.fromEntries(list.map((p) => [p.slug, p]));
}

export const LEVELS = {
  1: { name: "Forgiving", blurb: "Survives neglect, low light and missed waterings. Perfect first plants.", attention: "A few minutes a month" },
  2: { name: "Easygoing", blurb: "Low effort with one or two needs to respect — usually light or a watering rhythm.", attention: "A few minutes a week" },
  3: { name: "Attentive", blurb: "Wants consistent moisture, humidity or specific conditions. Rewarding once you learn it.", attention: "A couple of check-ins a week" },
  4: { name: "Devoted", blurb: "Fussy plants that show every mistake. For confident growers with the right setup.", attention: "Near-daily attention" },
};

export const LIGHT = { 1: "Low light", 2: "Medium light", 3: "Bright indirect", 4: "Direct sun" };
export const HUMIDITY = { 1: "Dry air OK", 2: "Average humidity", 3: "High humidity" };
export const SIZE = { S: "Small", M: "Medium", L: "Large" };

export function lightRange(p) {
  return p.light.min === p.light.max ? LIGHT[p.light.min] : `${LIGHT[p.light.min]} – ${LIGHT[p.light.max].toLowerCase()}`;
}

export function waterLabel(p) {
  const [a, b] = p.water.days;
  if (b >= 14 && a % 7 === 0 && b % 7 === 0) return `Every ${a / 7}–${b / 7} weeks`;
  return `Every ${a}–${b} days`;
}

export const fToC = (f) => Math.round(((f - 32) * 5) / 9);

export const ACTIONS = {
  watered: "Watered",
  fertilized: "Fertilized",
  misted: "Misted",
  repotted: "Repotted",
  pruned: "Pruned",
  rotated: "Rotated",
  cleaned: "Cleaned leaves",
  "pest-treatment": "Treated pests",
  propagated: "Propagated",
  moved: "Moved",
  note: "Note",
};

export function initials(name) {
  return esc((name || "?").trim().charAt(0).toUpperCase());
}

export function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

export function modal(html, onMount) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="modal-close" aria-label="Close">×</button>${html}</div>`;
  const close = () => {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest(".modal-close")) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(wrap);
  onMount?.(wrap.querySelector(".modal"), close);
  wrap.querySelector("input, select, textarea, button:not(.modal-close)")?.focus();
  return close;
}

import { api, esc, initials } from "./util.js";
import { sprigIcon } from "./art.js";
import { homeView } from "./views/home.js";
import { catalogView, plantView } from "./views/plants.js";
import { matchView } from "./views/match.js";
import { loginView, signupView } from "./views/auth.js";
import { gardenView, gardenPlantView } from "./views/garden.js";
import { profileView, accountView, peopleView } from "./views/social.js";

const routes = [
  [/^\/$/, homeView, "Home"],
  [/^\/plants\/?$/, catalogView, "Plant guide"],
  [/^\/plants\/([a-z0-9-]+)$/, plantView, null],
  [/^\/match\/?$/, matchView, "Find your plants"],
  [/^\/login\/?$/, loginView, "Log in"],
  [/^\/signup\/?$/, signupView, "Create account"],
  [/^\/garden\/?$/, gardenView, "My garden", true],
  [/^\/garden\/(\d+)$/, gardenPlantView, "My garden", true],
  [/^\/account\/?$/, accountView, "Account", true],
  [/^\/people\/?$/, peopleView, "People"],
  [/^\/u\/([A-Za-z0-9_]+)$/, profileView, null],
];

export const state = { user: null };
const root = document.getElementById("app");
let renderToken = 0;

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  render();
}

export function setUser(user) {
  state.user = user;
  renderNav();
}

export function setTitle(title) {
  document.title = title ? `${title} · mik` : "mik — houseplants that fit your life";
}

function renderNav() {
  const u = state.user;
  const path = location.pathname;
  const link = (href, label) =>
    `<a href="${href}" class="${path === href || (href !== "/" && path.startsWith(href)) ? "active" : ""}">${label}</a>`;
  document.getElementById("nav").innerHTML = `
    <a class="brand" href="/">${sprigIcon(22)}<span>mik</span></a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <div class="nav-links">
      ${link("/plants", "Plant guide")}
      ${link("/match", "Find your plants")}
      ${link("/garden", "My garden")}
      ${link("/people", "People")}
      ${
        u
          ? `<a href="/account" class="nav-user ${path === "/account" ? "active" : ""}"><span class="avatar sm">${initials(u.displayName)}</span><span>${esc(u.displayName)}</span></a>`
          : `<a href="/login" class="btn btn-small btn-ghost-light">Log in</a><a href="/signup" class="btn btn-small btn-clay">Sign up</a>`
      }
    </div>`;
}

async function render() {
  const token = ++renderToken;
  const path = location.pathname;
  document.body.classList.remove("nav-open");
  renderNav();
  for (const [re, view, title, needsAuth] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (needsAuth && !state.user) {
      navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true });
      return;
    }
    setTitle(title);
    root.innerHTML = `<div class="loading">${sprigIcon(28)}</div>`;
    try {
      const el = document.createElement("div");
      await view(el, m.slice(1), { state, navigate, setUser, setTitle, isCurrent: () => token === renderToken });
      if (token !== renderToken) return;
      root.replaceChildren(el);
    } catch (err) {
      if (token !== renderToken) return;
      if (err.status === 401) {
        setUser(null);
        navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true });
        return;
      }
      root.innerHTML = `<section class="page narrow"><h1>Hmm.</h1><p>${esc(err.message)}</p><p><a href="/">Go home</a></p></section>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  setTitle("Not found");
  root.innerHTML = `<section class="page narrow"><h1>Page not found</h1><p>This page wandered off. <a href="/plants">Browse the plant guide</a>.</p></section>`;
}

document.addEventListener("click", (e) => {
  const toggle = e.target.closest(".nav-toggle");
  if (toggle) {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
    return;
  }
  const a = e.target.closest("a[href]");
  if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.preventDefault();
  if (url.pathname + url.search !== location.pathname + location.search) navigate(url.pathname + url.search + url.hash);
  else if (url.hash) document.querySelector(url.hash)?.scrollIntoView({ behavior: "smooth" });
});

window.addEventListener("popstate", render);

(async () => {
  try {
    state.user = (await api("/me")).user;
  } catch {
    state.user = null;
  }
  render();
})();

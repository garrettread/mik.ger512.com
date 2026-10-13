import { api, esc } from "../util.js";
import { sprigIcon } from "../art.js";

function nextPath() {
  const next = new URLSearchParams(location.search).get("next") || "/garden";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/garden";
}

function authShell(title, sub, fields, submit, foot) {
  return `
    <section class="page auth">
      <form class="card auth-card" novalidate>
        <div class="auth-mark">${sprigIcon(30)}</div>
        <h1>${title}</h1>
        <p class="muted">${sub}</p>
        ${fields}
        <p class="form-error" role="alert" hidden></p>
        <button class="btn btn-block" type="submit">${submit}</button>
        <p class="auth-foot">${foot}</p>
      </form>
    </section>`;
}

function wire(el, onSubmit) {
  const form = el.querySelector("form");
  const err = form.querySelector(".form-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

export async function loginView(el, _p, { state, navigate, setUser }) {
  if (state.user) return navigate(nextPath(), { replace: true });
  const next = encodeURIComponent(nextPath());
  el.innerHTML = authShell(
    "Welcome back",
    "Log in to see your garden and keep your streak going.",
    `<label class="field"><span>Username or email</span><input name="login" autocomplete="username" required></label>
     <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>`,
    "Log in",
    `New here? <a href="/signup?next=${esc(next)}">Create an account</a>`
  );
  wire(el, async (data) => {
    const { user } = await api("/auth/login", { method: "POST", body: data });
    setUser(user);
    navigate(nextPath(), { replace: true });
  });
}

export async function signupView(el, _p, { state, navigate, setUser }) {
  if (state.user) return navigate("/garden", { replace: true });
  const next = encodeURIComponent(nextPath());
  el.innerHTML = authShell(
    "Create your account",
    "Track your plants, log care and follow other growers.",
    `<label class="field"><span>Display name</span><input name="displayName" maxlength="50" autocomplete="name" placeholder="Mik"></label>
     <label class="field"><span>Username</span><input name="username" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" autocomplete="username" required placeholder="plantlover_22"><small>3–24 letters, numbers or underscores.</small></label>
     <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
     <label class="field"><span>Password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required><small>At least 8 characters.</small></label>`,
    "Create account",
    `Already have one? <a href="/login?next=${esc(next)}">Log in</a>`
  );
  wire(el, async (data) => {
    const { user } = await api("/auth/signup", { method: "POST", body: data });
    setUser(user);
    navigate(nextPath(), { replace: true });
  });
}

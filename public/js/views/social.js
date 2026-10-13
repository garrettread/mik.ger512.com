import { api, esc, initials, plantMap, localToday, addDays, fmtDate, relDay, ACTIONS, toast, modal } from "../util.js";
import { plantArt } from "../art.js";
import { streakBanner } from "./garden.js";

function userRow(u, extra = "") {
  return `
    <a class="user-row" href="/u/${esc(u.username)}">
      <span class="avatar">${initials(u.displayName)}</span>
      <span class="user-row-text"><strong>${esc(u.displayName)}</strong><span class="muted">@${esc(u.username)}${extra}</span>${u.bio ? `<span class="user-bio">${esc(u.bio)}</span>` : ""}</span>
    </a>`;
}

// 12-week activity grid, Monday-first columns.
function heatmap(days) {
  const set = new Set(days);
  const today = localToday();
  const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const start = addDays(today, -(7 * 11 + dow));
  let cells = "";
  for (let i = 0; i < 84; i++) {
    const d = addDays(start, i);
    if (d > today) {
      cells += `<span class="hm-cell future"></span>`;
      continue;
    }
    cells += `<span class="hm-cell ${set.has(d) ? "on" : ""}" title="${esc(fmtDate(d))}${set.has(d) ? " · logged" : ""}"></span>`;
  }
  return `<div class="heatmap" aria-label="Logging activity over the last 12 weeks">${cells}</div>`;
}

function activityItem(r, byslug, who) {
  const p = byslug[r.plantSlug];
  return `
    <li class="activity">
      <span class="tag tag-${esc(r.action)}">${esc(ACTIONS[r.action] || r.action)}</span>
      <span>${who ? `<a href="/u/${esc(who.username)}">${esc(who.displayName)}</a> · ` : ""}${esc(r.nickname || p?.name || "a plant")}${r.notes ? ` — <span class="muted">${esc(r.notes)}</span>` : ""}</span>
      <span class="muted small">${esc(relDay(r.loggedOn))}</span>
    </li>`;
}

async function renderProfile(el, username, ctx, { own }) {
  const [byslug, prof] = await Promise.all([plantMap(), api(`/users/${encodeURIComponent(username)}?today=${localToday()}`)]);
  const u = prof.user;
  ctx.setTitle(own ? "Account" : u.displayName);
  const feed = own ? await api("/feed").catch(() => ({ items: [] })) : null;

  const followBtn = () =>
    prof.isMe
      ? ""
      : ctx.state.user
        ? `<button class="btn ${prof.isFollowing ? "btn-ghost" : ""} follow">${prof.isFollowing ? "Following" : "Follow"}</button>`
        : `<a class="btn" href="/login?next=/u/${esc(u.username)}">Log in to follow</a>`;

  el.innerHTML = `
    <section class="page">
      <header class="profile-head">
        <span class="avatar xl">${initials(u.displayName)}</span>
        <div class="profile-id">
          <h1>${esc(u.displayName)}</h1>
          <p class="muted">@${esc(u.username)} · joined ${esc(fmtDate(u.joined))}</p>
          ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : own ? `<p class="muted">Add a bio so other growers know what you're into.</p>` : ""}
        </div>
        <div class="profile-actions">${followBtn()}${prof.isMe && !own ? `<a class="btn btn-ghost" href="/account">Edit profile</a>` : ""}</div>
      </header>

      <div class="stats">
        <div class="stat"><strong>${prof.streak.current}</strong><span>Day streak</span></div>
        <div class="stat"><strong>${prof.streak.longest}</strong><span>Longest streak</span></div>
        <div class="stat"><strong>${prof.plants.length}</strong><span>Plants</span></div>
        <button class="stat link" data-list="followers"><strong class="followers-n">${prof.followers}</strong><span>Followers</span></button>
        <button class="stat link" data-list="following"><strong>${prof.following}</strong><span>Following</span></button>
      </div>

      ${own ? streakBanner(prof.streak) : ""}

      <section class="card">
        <h2>Logging activity</h2>
        ${heatmap(prof.streak.recentDays)}
        <p class="muted small">${prof.totalLogs} care entries over ${prof.streak.activeDays} day${prof.streak.activeDays === 1 ? "" : "s"}.</p>
      </section>

      ${
        own
          ? `<section class="card">
              <h2>Edit profile</h2>
              <form class="stack profile-form">
                <label class="field"><span>Display name</span><input name="displayName" maxlength="50" required value="${esc(u.displayName)}"></label>
                <label class="field"><span>Bio</span><textarea name="bio" maxlength="280" rows="3" placeholder="What do you grow?">${esc(u.bio)}</textarea></label>
                <p class="muted small">Email: ${esc(ctx.state.user.email)}</p>
                <div class="row-actions"><button class="btn" type="submit">Save</button><a class="btn btn-ghost" href="/u/${esc(u.username)}">View public profile</a><button class="btn btn-ghost logout" type="button">Log out</button></div>
              </form>
            </section>`
          : ""
      }

      <section>
        <h2>${own ? "Your" : esc(u.displayName) + "'s"} plants</h2>
        ${
          prof.plants.length
            ? `<div class="shelf">${prof.plants
                .map((gp) => {
                  const p = byslug[gp.plantSlug];
                  if (!p) return "";
                  return `<a class="shelf-item" href="${own ? `/garden/${gp.id}` : `/plants/${p.slug}`}">${plantArt(p, { size: 80 })}<strong>${esc(gp.nickname || p.name)}</strong>${gp.nickname ? `<span class="muted small">${esc(p.name)}</span>` : ""}</a>`;
                })
                .join("")}</div>`
            : `<p class="muted">No plants yet.${own ? ` <a href="/garden">Add some to your garden</a>.` : ""}</p>`
        }
      </section>

      <div class="two-col">
        <section class="card">
          <h2>Recent care</h2>
          ${prof.recent.length ? `<ul class="activity-list">${prof.recent.map((r) => activityItem(r, byslug)).join("")}</ul>` : `<p class="muted">Nothing logged yet.</p>`}
        </section>
        ${
          own
            ? `<section class="card">
                <h2>From people you follow</h2>
                ${
                  feed.items.length
                    ? `<ul class="activity-list">${feed.items.map((r) => activityItem(r, byslug, { username: r.username, displayName: r.displayName })).join("")}</ul>`
                    : `<p class="muted">When people you follow log care, it shows up here. <a href="/people">Find growers to follow</a>.</p>`
                }
              </section>`
            : ""
        }
      </div>
    </section>`;

  el.querySelector(".follow")?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const res = await api(`/users/${encodeURIComponent(u.username)}/follow`, { method: prof.isFollowing ? "DELETE" : "POST" });
      prof.isFollowing = res.isFollowing;
      b.textContent = res.isFollowing ? "Following" : "Follow";
      b.classList.toggle("btn-ghost", res.isFollowing);
      el.querySelector(".followers-n").textContent = res.followers;
    } catch (ex) {
      toast(ex.message);
    } finally {
      b.disabled = false;
    }
  });

  el.querySelectorAll("[data-list]").forEach((b) =>
    b.addEventListener("click", async () => {
      const which = b.dataset.list;
      const { users } = await api(`/users/${encodeURIComponent(u.username)}/${which}`);
      modal(
        `<h2>${which === "followers" ? "Followers" : "Following"}</h2>
         ${users.length ? `<div class="user-list">${users.map((x) => userRow(x)).join("")}</div>` : `<p class="muted">Nobody yet.</p>`}`,
        (box, close) => box.addEventListener("click", (e) => e.target.closest("a") && close())
      );
    })
  );

  const form = el.querySelector(".profile-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const { user } = await api("/me", { method: "PATCH", body: Object.fromEntries(new FormData(form)) });
      ctx.setUser(user);
      toast("Profile saved");
      ctx.navigate("/account", { replace: true });
    } catch (ex) {
      toast(ex.message);
    }
  });
  el.querySelector(".logout")?.addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" });
    ctx.setUser(null);
    ctx.navigate("/");
  });
}

export function profileView(el, [username], ctx) {
  return renderProfile(el, username, ctx, { own: false });
}

export function accountView(el, _p, ctx) {
  return renderProfile(el, ctx.state.user.username, ctx, { own: true });
}

export async function peopleView(el, _p, { state }) {
  el.innerHTML = `
    <section class="page narrow">
      <div class="page-head">
        <h1>People</h1>
        <p>Find other growers, follow them and see what they're caring for.</p>
      </div>
      <input type="search" class="people-search" placeholder="Search by name or username…" aria-label="Search people" value="${esc(new URLSearchParams(location.search).get("q") || "")}">
      <div class="user-list people-results"></div>
      ${state.user ? "" : `<p class="muted center"><a href="/signup">Create an account</a> to follow people.</p>`}
    </section>`;
  const input = el.querySelector(".people-search");
  const out = el.querySelector(".people-results");
  let timer;
  async function search() {
    const q = input.value.trim();
    const { users } = await api(`/users?q=${encodeURIComponent(q)}`);
    out.innerHTML = users.length
      ? users.map((u) => userRow(u, ` · ${u.plantCount} plant${u.plantCount === 1 ? "" : "s"} · ${u.followerCount} follower${u.followerCount === 1 ? "" : "s"}`)).join("")
      : `<p class="muted">No one found.</p>`;
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(search, 250);
  });
  await search();
}

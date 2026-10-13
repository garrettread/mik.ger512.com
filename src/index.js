import plants from "../public/data/plants.json";
import { hashPassword, verifyPassword, newSessionToken, sha256Hex } from "./auth.js";

const PLANT_SLUGS = new Set(plants.map((p) => p.slug));
const ACTIONS = ["watered", "fertilized", "misted", "repotted", "pruned", "rotated", "cleaned", "pest-treatment", "propagated", "moved", "note"];
const SESSION_DAYS = 30;
const COOKIE = "mik_session";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (request.method !== "GET" && !sameOrigin(request, url)) {
        return json({ error: "Cross-origin request blocked." }, 403);
      }
      return await route(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong." }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function sameOrigin(request, url) {
  const origin = request.headers.get("origin");
  return !origin || origin === url.origin;
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

function str(value, max, field, { required = false } = {}) {
  const s = typeof value === "string" ? value.trim() : "";
  if (required && !s) throw new HttpError(400, `${field} is required.`);
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters.`);
  return s;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

// The client sends its local calendar date; accept it only if it's plausible for some timezone.
function clientToday(value) {
  const utc = isoDate(new Date());
  if (typeof value === "string" && DATE_RE.test(value) && [addDays(utc, -1), utc, addDays(utc, 1)].includes(value)) {
    return value;
  }
  return utc;
}

// ---------- sessions ----------

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function currentUser(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.display_name, u.bio, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
  )
    .bind(await sha256Hex(token))
    .first();
  return row || null;
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "Please log in.");
  return user;
}

async function startSession(env, userId) {
  const token = newSessionToken();
  await env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .bind(await sha256Hex(token), userId, `+${SESSION_DAYS} days`)
    .run();
  return sessionCookie(token, SESSION_DAYS * 86400);
}

function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, bio: u.bio, joined: u.created_at };
}

// ---------- streaks ----------

async function streakStats(env, userId, today) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT streak_day AS d FROM care_logs WHERE user_id = ? ORDER BY d DESC`
  )
    .bind(userId)
    .all();
  const days = results.map((r) => r.d);
  const set = new Set(days);

  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of [...days].reverse()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest, loggedToday: set.has(today), activeDays: days.length, recentDays: days.slice(0, 120) };
}

// ---------- routing ----------

async function route(request, env, url) {
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const method = request.method;
  const [a, b, c] = parts;

  if (a === "auth" && method === "POST") {
    if (b === "signup") return signup(request, env);
    if (b === "login") return login(request, env);
    if (b === "logout") return logout(request, env);
  }

  if (a === "me" && !b) {
    if (method === "GET") {
      const user = await currentUser(request, env);
      return json({ user: user ? { ...publicUser(user), email: user.email } : null });
    }
    if (method === "PATCH") return updateMe(request, env);
  }

  if (a === "feed" && method === "GET") return feed(request, env, url);

  if (a === "users") {
    if (!b && method === "GET") return searchUsers(env, url);
    if (b && !c && method === "GET") return profile(request, env, url, b);
    if (b && (c === "followers" || c === "following") && method === "GET") return followList(env, b, c);
    if (b && c === "follow" && method === "POST") return follow(request, env, b, true);
    if (b && c === "follow" && method === "DELETE") return follow(request, env, b, false);
  }

  if (a === "garden") {
    if (!b && method === "GET") return gardenList(request, env);
    if (!b && method === "POST") return gardenAdd(request, env);
    const id = Number(b);
    if (Number.isInteger(id) && id > 0) {
      if (!c && method === "PATCH") return gardenUpdate(request, env, id);
      if (!c && method === "DELETE") return gardenDelete(request, env, id);
      if (c === "logs" && method === "GET") return logsList(request, env, id);
      if (c === "logs" && method === "POST") return logsAdd(request, env, id);
    }
  }

  if (a === "logs" && b && method === "DELETE") return logsDelete(request, env, Number(b));

  throw new HttpError(404, "Not found.");
}

// ---------- auth ----------

const USERNAME_RE = /^[a-z0-9_]{3,24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function signup(request, env) {
  const data = await body(request);
  const username = str(data.username, 24, "Username", { required: true });
  const email = str(data.email, 254, "Email", { required: true }).toLowerCase();
  const displayName = str(data.displayName, 50, "Display name") || username;
  const password = typeof data.password === "string" ? data.password : "";

  if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username must be 3–24 letters, numbers or underscores.");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Please enter a valid email.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (password.length > 200) throw new HttpError(400, "Password is too long.");

  const taken = await env.DB.prepare(`SELECT username, email FROM users WHERE username = ? OR email = ?`)
    .bind(username, email)
    .first();
  if (taken) {
    throw new HttpError(409, taken.email.toLowerCase() === email ? "That email already has an account." : "That username is taken.");
  }

  const { hash, salt } = await hashPassword(password);
  const user = await env.DB.prepare(
    `INSERT INTO users (username, email, display_name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)
     RETURNING id, username, email, display_name, bio, created_at`
  )
    .bind(username, email, displayName, hash, salt)
    .first();

  const cookie = await startSession(env, user.id);
  return json({ user: { ...publicUser(user), email: user.email } }, 201, { "set-cookie": cookie });
}

async function login(request, env) {
  const data = await body(request);
  const ident = str(data.login, 254, "Username or email", { required: true });
  const password = typeof data.password === "string" ? data.password : "";
  const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ? OR email = ?`).bind(ident, ident.toLowerCase()).first();
  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    throw new HttpError(401, "Wrong username/email or password.");
  }
  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND expires_at <= datetime('now')`).bind(user.id).run();
  const cookie = await startSession(env, user.id);
  return json({ user: { ...publicUser(user), email: user.email } }, 200, { "set-cookie": cookie });
}

async function logout(request, env) {
  const token = readCookie(request, COOKIE);
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function updateMe(request, env) {
  const user = await requireUser(request, env);
  const data = await body(request);
  const displayName = str(data.displayName, 50, "Display name", { required: true });
  const bio = str(data.bio, 280, "Bio");
  const row = await env.DB.prepare(
    `UPDATE users SET display_name = ?, bio = ? WHERE id = ? RETURNING id, username, email, display_name, bio, created_at`
  )
    .bind(displayName, bio, user.id)
    .first();
  return json({ user: { ...publicUser(row), email: row.email } });
}

// ---------- users & follows ----------

async function userByName(env, username) {
  const u = await env.DB.prepare(`SELECT id, username, display_name, bio, created_at FROM users WHERE username = ?`)
    .bind(username)
    .first();
  if (!u) throw new HttpError(404, "User not found.");
  return u;
}

async function searchUsers(env, url) {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 50);
  const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.bio, u.created_at,
            (SELECT COUNT(*) FROM user_plants p WHERE p.user_id = u.id) AS plant_count,
            (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS follower_count
       FROM users u
      WHERE ? = '' OR u.username LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\'
      ORDER BY follower_count DESC, u.created_at DESC
      LIMIT 30`
  )
    .bind(q, like, like)
    .all();
  return json({
    users: results.map((u) => ({ ...publicUser(u), plantCount: u.plant_count, followerCount: u.follower_count })),
  });
}

async function profile(request, env, url, username) {
  const u = await userByName(env, username);
  const viewer = await currentUser(request, env);
  const today = clientToday(url.searchParams.get("today"));

  const [counts, isFollowing, garden, recent, streak] = await Promise.all([
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,
              (SELECT COUNT(*) FROM care_logs WHERE user_id = ?1) AS logs`
    )
      .bind(u.id)
      .first(),
    viewer && viewer.id !== u.id
      ? env.DB.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`).bind(viewer.id, u.id).first()
      : null,
    env.DB.prepare(`SELECT id, plant_slug, nickname, location, acquired_on, created_at FROM user_plants WHERE user_id = ? ORDER BY created_at DESC`)
      .bind(u.id)
      .all(),
    env.DB.prepare(
      `SELECT l.id, l.action, l.notes, l.logged_on, l.created_at, p.plant_slug, p.nickname
         FROM care_logs l JOIN user_plants p ON p.id = l.user_plant_id
        WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 20`
    )
      .bind(u.id)
      .all(),
    streakStats(env, u.id, today),
  ]);

  return json({
    user: publicUser(u),
    isMe: !!viewer && viewer.id === u.id,
    isFollowing: !!isFollowing,
    followers: counts.followers,
    following: counts.following,
    totalLogs: counts.logs,
    streak,
    plants: garden.results.map(gardenRow),
    recent: recent.results.map((r) => ({
      id: r.id, action: r.action, notes: r.notes, loggedOn: r.logged_on, createdAt: r.created_at,
      plantSlug: r.plant_slug, nickname: r.nickname,
    })),
  });
}

async function followList(env, username, which) {
  const u = await userByName(env, username);
  const sql =
    which === "followers"
      ? `SELECT u.id, u.username, u.display_name, u.bio, u.created_at FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ? ORDER BY f.created_at DESC`
      : `SELECT u.id, u.username, u.display_name, u.bio, u.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? ORDER BY f.created_at DESC`;
  const { results } = await env.DB.prepare(sql).bind(u.id).all();
  return json({ users: results.map(publicUser) });
}

async function follow(request, env, username, on) {
  const viewer = await requireUser(request, env);
  const u = await userByName(env, username);
  if (u.id === viewer.id) throw new HttpError(400, "You can't follow yourself.");
  if (on) {
    await env.DB.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)`).bind(viewer.id, u.id).run();
  } else {
    await env.DB.prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`).bind(viewer.id, u.id).run();
  }
  const { n } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?`).bind(u.id).first();
  return json({ isFollowing: on, followers: n });
}

async function feed(request, env, url) {
  const viewer = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT l.id, l.action, l.notes, l.logged_on, l.created_at, p.plant_slug, p.nickname, u.username, u.display_name
       FROM care_logs l
       JOIN follows f ON f.followee_id = l.user_id AND f.follower_id = ?
       JOIN user_plants p ON p.id = l.user_plant_id
       JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC LIMIT 30`
  )
    .bind(viewer.id)
    .all();
  return json({
    items: results.map((r) => ({
      id: r.id, action: r.action, notes: r.notes, loggedOn: r.logged_on, createdAt: r.created_at,
      plantSlug: r.plant_slug, nickname: r.nickname, username: r.username, displayName: r.display_name,
    })),
  });
}

// ---------- garden ----------

function gardenRow(r) {
  return {
    id: r.id, plantSlug: r.plant_slug, nickname: r.nickname, location: r.location,
    acquiredOn: r.acquired_on, notes: r.notes, createdAt: r.created_at,
    lastWatered: r.last_watered ?? null, lastLog: r.last_log ?? null, logCount: r.log_count ?? 0,
  };
}

async function ownedPlant(env, userId, id) {
  const row = await env.DB.prepare(`SELECT * FROM user_plants WHERE id = ? AND user_id = ?`).bind(id, userId).first();
  if (!row) throw new HttpError(404, "Plant not found in your garden.");
  return row;
}

function plantFields(data, partial) {
  const out = {};
  if (!partial || data.plantSlug !== undefined) {
    if (!PLANT_SLUGS.has(data.plantSlug)) throw new HttpError(400, "Pick a plant from the catalog.");
    out.plant_slug = data.plantSlug;
  }
  if (!partial || data.nickname !== undefined) out.nickname = str(data.nickname, 60, "Nickname");
  if (!partial || data.location !== undefined) out.location = str(data.location, 60, "Location");
  if (!partial || data.notes !== undefined) out.notes = str(data.notes, 1000, "Notes");
  if (!partial || data.acquiredOn !== undefined) {
    const d = data.acquiredOn || null;
    if (d !== null && !DATE_RE.test(d)) throw new HttpError(400, "Invalid date.");
    out.acquired_on = d;
  }
  return out;
}

async function gardenList(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT p.*,
            (SELECT MAX(logged_on) FROM care_logs l WHERE l.user_plant_id = p.id AND l.action = 'watered') AS last_watered,
            (SELECT MAX(logged_on) FROM care_logs l WHERE l.user_plant_id = p.id) AS last_log,
            (SELECT COUNT(*) FROM care_logs l WHERE l.user_plant_id = p.id) AS log_count
       FROM user_plants p WHERE p.user_id = ? ORDER BY p.created_at DESC`
  )
    .bind(user.id)
    .all();
  return json({ plants: results.map(gardenRow) });
}

async function gardenAdd(request, env) {
  const user = await requireUser(request, env);
  const f = plantFields(await body(request), false);
  const { n } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM user_plants WHERE user_id = ?`).bind(user.id).first();
  if (n >= 300) throw new HttpError(400, "Garden limit reached (300 plants).");
  const row = await env.DB.prepare(
    `INSERT INTO user_plants (user_id, plant_slug, nickname, location, acquired_on, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(user.id, f.plant_slug, f.nickname, f.location, f.acquired_on, f.notes)
    .first();
  return json({ plant: gardenRow(row) }, 201);
}

async function gardenUpdate(request, env, id) {
  const user = await requireUser(request, env);
  await ownedPlant(env, user.id, id);
  const f = plantFields(await body(request), true);
  const keys = Object.keys(f);
  if (!keys.length) throw new HttpError(400, "Nothing to update.");
  const row = await env.DB.prepare(
    `UPDATE user_plants SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND user_id = ? RETURNING *`
  )
    .bind(...keys.map((k) => f[k]), id, user.id)
    .first();
  return json({ plant: gardenRow(row) });
}

async function gardenDelete(request, env, id) {
  const user = await requireUser(request, env);
  await ownedPlant(env, user.id, id);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM care_logs WHERE user_plant_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM user_plants WHERE id = ? AND user_id = ?`).bind(id, user.id),
  ]);
  return json({ ok: true });
}

// ---------- care logs ----------

function logRow(r) {
  return { id: r.id, action: r.action, notes: r.notes, loggedOn: r.logged_on, createdAt: r.created_at };
}

async function logsList(request, env, id) {
  const user = await requireUser(request, env);
  const plant = await ownedPlant(env, user.id, id);
  const { results } = await env.DB.prepare(
    `SELECT * FROM care_logs WHERE user_plant_id = ? ORDER BY logged_on DESC, created_at DESC LIMIT 200`
  )
    .bind(id)
    .all();
  return json({ plant: gardenRow(plant), logs: results.map(logRow) });
}

async function logsAdd(request, env, id) {
  const user = await requireUser(request, env);
  await ownedPlant(env, user.id, id);
  const data = await body(request);
  const today = clientToday(data.today);
  const actions = Array.isArray(data.actions) ? data.actions : [data.action];
  if (!actions.length || actions.length > ACTIONS.length || !actions.every((a) => ACTIONS.includes(a))) {
    throw new HttpError(400, "Pick what you did.");
  }
  const notes = str(data.notes, 500, "Notes");
  const loggedOn = data.loggedOn || today;
  if (!DATE_RE.test(loggedOn) || loggedOn > today) throw new HttpError(400, "Date can't be in the future.");

  const unique = [...new Set(actions)];
  const rows = await env.DB.batch(
    unique.map((action) =>
      env.DB.prepare(
        `INSERT INTO care_logs (user_plant_id, user_id, action, notes, logged_on, streak_day) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
      ).bind(id, user.id, action, notes, loggedOn, today)
    )
  );
  const streak = await streakStats(env, user.id, today);
  return json({ logs: rows.map((r) => logRow(r.results[0])), streak }, 201);
}

async function logsDelete(request, env, id) {
  const user = await requireUser(request, env);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found.");
  const res = await env.DB.prepare(`DELETE FROM care_logs WHERE id = ? AND user_id = ?`).bind(id, user.id).run();
  if (!res.meta.changes) throw new HttpError(404, "Log entry not found.");
  return json({ ok: true });
}

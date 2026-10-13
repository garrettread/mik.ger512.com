CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE user_plants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plant_slug TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  acquired_on TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX user_plants_user ON user_plants(user_id);

-- logged_on: the day the care happened (may be backdated).
-- streak_day: the user's local day the entry was made; streaks count these so they can't be backfilled.
CREATE TABLE care_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_plant_id INTEGER NOT NULL REFERENCES user_plants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  logged_on TEXT NOT NULL,
  streak_day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX care_logs_plant ON care_logs(user_plant_id, logged_on);
CREATE INDEX care_logs_user ON care_logs(user_id, streak_day);

CREATE TABLE follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee ON follows(followee_id);

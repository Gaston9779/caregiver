CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  risk_level TEXT NOT NULL
);

CREATE TABLE caregiver_links (
  user_id INTEGER NOT NULL REFERENCES users(id),
  caregiver_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (user_id, caregiver_id)
);

CREATE TABLE heartbeats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE safe_zones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE caregiver_contacts (
  caregiver_id INTEGER PRIMARY KEY REFERENCES users(id),
  phone_number TEXT NOT NULL
);

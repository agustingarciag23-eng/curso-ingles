-- Curso Inglés: esquema inicial de la base de datos D1

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,                 -- último día con sesión completada (YYYY-MM-DD, hora de Madrid)
  free_week TEXT,                -- semana ISO en la que se gastó el día libre (ej. 2026-W44)
  theme TEXT NOT NULL DEFAULT 'default',
  avatar TEXT NOT NULL DEFAULT 'default',
  placement_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Estado de cada tema: completed (superado), skipped (dejado para después), started
CREATE TABLE IF NOT EXISTS topic_progress (
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL,
  best REAL,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, topic)
);

-- Historial de respuestas (sirve para saber qué ejercicios ya has visto)
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  ref TEXT NOT NULL,
  kind TEXT NOT NULL,            -- check | practice | challenge | warmup | ai
  correct INTEGER NOT NULL,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_answers_user_topic ON answers (email, topic, kind);

-- Ejercicios fallados que volverán en el calentamiento
CREATE TABLE IF NOT EXISTS review (
  email TEXT NOT NULL,
  ref TEXT NOT NULL,             -- "<tema>:<id del ejercicio>"
  topic TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, ref)
);

CREATE TABLE IF NOT EXISTS purchases (
  email TEXT NOT NULL,
  item TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, item)
);

-- "Mi respuesta también vale" y errores reportados en ejercicios de IA
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,            -- valid_answer | ai_error
  topic TEXT,
  ref TEXT,
  answer TEXT,
  exercise TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ejercicios generados con Gemini (se guardan para reutilizarlos)
CREATE TABLE IF NOT EXISTS ai_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  data TEXT NOT NULL,
  reported INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage (
  email TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, day)
);

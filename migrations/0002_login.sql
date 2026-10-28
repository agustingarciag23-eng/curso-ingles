-- Intentos fallidos de inicio de sesión (para frenar a quien intente adivinar la contraseña)
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  hour TEXT NOT NULL,            -- YYYY-MM-DDTHH (UTC)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, hour)
);

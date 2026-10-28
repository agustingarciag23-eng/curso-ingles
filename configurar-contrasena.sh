#!/bin/bash
# Pone (o cambia) la contraseña de Curso Inglés y vuelve a publicar la web.
# Uso (desde la carpeta del proyecto):  bash configurar-contrasena.sh
set -e
cd "$(dirname "$0")"
paso() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

paso "1/3 Actualizando la base de datos"
echo "   Si pregunta si quieres continuar, responde y (yes)."
npx wrangler d1 migrations apply curso-ingles --remote

paso "2/3 Guardando la contraseña"
echo "   Escribe la contraseña que quieras usar y pulsa Enter."
echo "   Al escribirla NO se verá nada en pantalla; es normal."
npx wrangler pages secret put APP_PASSWORD --project-name curso-ingles

paso "3/3 Publicando la web"
npx wrangler pages deploy public --project-name curso-ingles --branch main

git add -A
git commit -m "Login con contraseña" >/dev/null 2>&1 || true
git push >/dev/null 2>&1 || true

printf '\n\033[1;32m✓ Listo.\033[0m Abre https://curso-ingles.pages.dev y entra con tu contraseña.\n'

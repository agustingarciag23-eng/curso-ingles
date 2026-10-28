#!/bin/bash
# Activa Cloudflare Access en Curso Inglés y vuelve a publicar.
# Uso:  bash configurar-acceso.sh <team-domain> <aud-tag>
# Ejemplo: bash configurar-acceso.sh agustin.cloudflareaccess.com 4f1c...e9
set -e
cd "$(dirname "$0")"
TEAM="${1#https://}"; TEAM="${TEAM%/}"; AUD="$2"
if [ -z "$TEAM" ] || [ -z "$AUD" ]; then
  echo "Faltan datos. Uso: bash configurar-acceso.sh <team-domain> <aud-tag>"; exit 1
fi
case "$TEAM" in *.cloudflareaccess.com) ;; *) TEAM="$TEAM.cloudflareaccess.com";; esac

sed -i '' -E "s|^ACCESS_TEAM_DOMAIN = \"[^\"]*\"|ACCESS_TEAM_DOMAIN = \"$TEAM\"|" wrangler.toml
sed -i '' -E "s|^ACCESS_AUD = \"[^\"]*\"|ACCESS_AUD = \"$AUD\"|" wrangler.toml
grep -E "^ACCESS_" wrangler.toml

git add -A
git commit -m "Configurar Cloudflare Access" >/dev/null 2>&1 || true
git push >/dev/null 2>&1 || echo "(No se pudo subir a GitHub; no pasa nada, la web se publica igual)"

npx wrangler pages deploy public --project-name curso-ingles --branch main

printf '\n\033[1;32m✓ Acceso configurado.\033[0m Abre https://curso-ingles.pages.dev y entra con tu correo.\n'

#!/bin/bash
# Publica Curso Inglés: sube el código a GitHub y lo despliega en Cloudflare Pages con su base de datos D1.
# Uso (desde la carpeta del proyecto):  bash publicar.sh
set -e
cd "$(dirname "$0")"

paso() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

paso "1/6 Guardando cambios en git"
git add -A
git commit -m "Preparar publicación" >/dev/null 2>&1 || true

paso "2/6 Subiendo a GitHub"
echo "   Si te pide Username: agustingarciag23-eng"
echo "   Si te pide Password: pega tu token (ghp_...). No se verá nada al pegar; pulsa Enter."
git push -u origin main

paso "3/6 Iniciando sesión en Cloudflare"
echo "   Se abrirá el navegador: pulsa 'Allow' y vuelve aquí."
npx wrangler whoami 2>/dev/null | grep -q "associated with the email" || npx wrangler login

if grep -q "PEGA-AQUI" wrangler.toml; then
  paso "4/6 Creando la base de datos"
  OUT=$(npx wrangler d1 create curso-ingles 2>&1) || { echo "$OUT"; exit 1; }
  echo "$OUT"
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -z "$ID" ]; then echo "No encontré el id de la base de datos en la salida. Pásale este texto a Claude."; exit 1; fi
  sed -i '' "s/PEGA-AQUI-EL-ID-DE-TU-BASE-D1/$ID/" wrangler.toml
  echo "   Base de datos creada: $ID"
else
  paso "4/6 La base de datos ya estaba configurada"
fi

paso "5/6 Creando las tablas"
echo "   Si pregunta si quieres continuar, responde y (yes)."
npx wrangler d1 migrations apply curso-ingles --remote

paso "6/6 Publicando la web"
npx wrangler pages project create curso-ingles --production-branch main 2>/dev/null || true
npx wrangler pages deploy public --project-name curso-ingles --branch main

git add -A
git commit -m "Configurar base de datos de Cloudflare" >/dev/null 2>&1 || true
git push >/dev/null 2>&1 || true

printf '\n\033[1;32m✓ Publicado.\033[0m Copia la dirección *.pages.dev que sale arriba y pásasela a Claude para configurar el acceso con tu correo.\n'

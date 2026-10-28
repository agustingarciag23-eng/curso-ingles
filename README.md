# Curso Inglés

Web personal para llevar la gramática inglesa de B1 a B2 (Cambridge B2 First) en sesiones de 15–30 minutos al día, con monedas y una tienda de personalización. Funciona en el Mac y en el iPhone con una única cuenta: el progreso se guarda en el servidor.

## Qué incluye esta versión

- **Test de nivel** de 12 preguntas que marca como superados los temas que ya dominas (siempre que también domines sus requisitos).
- **Sesión diaria**: calentamiento con tus fallos → lección → práctica guiada → reto final → resumen.
- **Mapa de temas** con requisitos: un tema se abre al sacar un 80 % o más en el reto de los temas que necesita. Puedes dejar un tema para después; lo que depende de él sigue bloqueado y el tema vuelve en los repasos.
- **Contenido verificado** de las ramas Presente y Pasado (6 temas, 108 ejercicios). El resto del mapa aparece como "Próximamente".
- **8 tipos de ejercicio**: opción múltiple, hueco, formación de palabras, key word transformation (Part 4), ordenar, escribir, traducir y corregir.
- Corrección que ignora mayúsculas, puntuación, el apóstrofo del iPhone (’) y contracciones (*don't* = *do not*).
- Botón **"Mi respuesta también vale"**: guarda la respuesta para revisarla en *Inicio → Respuestas guardadas para revisar*, sin darte el punto.
- **Monedas y tienda** solo de personalización (temas de color, avatares y postales).
- **Racha** con un día libre por semana.
- **Práctica extra con IA (Gemini)** cuando has visto todo el banco de un tema: ejercicios validados, guardados para reutilizarlos, marcados como IA y con botón para reportar errores. Límite diario configurable.
- **Acceso con contraseña** (secreto de Cloudflare, sin coste ni tarjeta): cookie de sesión de un año por dispositivo y bloqueo tras 10 intentos fallidos por hora.
- Se puede instalar en el iPhone como app (PWA).

## Estructura

```
public/            Web (se publica tal cual en Cloudflare Pages)
  content/         Árbol de temas, test de nivel, tienda y temas (JSON)
  js/ css/ icons/
functions/api/     API (Cloudflare Pages Functions)
src/lib/           Código compartido de la API (Access, racha, validación)
migrations/        Esquema de la base de datos D1
scripts/           check-content.mjs: valida el contenido
tests/             Pruebas y un servidor local sin dependencias
```

## Probar en local

Necesitas Node 20 o superior.

**Opción rápida, sin instalar nada:**

```bash
node tests/dev-server.mjs
# abre http://localhost:8788
```

**Opción recomendada (igual que en Cloudflare):**

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Pruebas y validación del contenido:

```bash
npm test
npm run check
```

## Publicar en Cloudflare (una sola vez)

1. **Sube el proyecto a GitHub** como repositorio `curso-ingles` (ya trae un commit inicial):
   ```bash
   git remote add origin https://github.com/agustingarciag23-eng/curso-ingles.git
   git push -u origin main
   ```
2. **Instala las herramientas e inicia sesión en Cloudflare:**
   ```bash
   npm install
   npx wrangler login
   ```
3. **Crea la base de datos** y copia el `database_id` que te devuelve en `wrangler.toml`:
   ```bash
   npx wrangler d1 create curso-ingles
   npm run db:remote
   ```
4. **Crea el proyecto de Pages.** Desde el panel de Cloudflare: *Workers & Pages → Create → Pages → Connect to Git*, elige el repositorio, sin comando de build y con `public` como directorio de salida. Así cada `git push` publica la web. (También puedes publicar a mano con `npm run deploy`.)
5. **Guarda la clave de Gemini como secreto** (opcional, solo para la práctica extra):
   ```bash
   npx wrangler pages secret put GEMINI_API_KEY --project-name curso-ingles
   ```
6. **Pon una contraseña a la web.** Desde la carpeta del proyecto:
   ```bash
   bash configurar-contrasena.sh
   ```
   Crea la tabla de inicio de sesión, te pide la contraseña (al escribirla no se ve nada) y vuelve a publicar. Cada dispositivo la pide una vez y la recuerda durante un año. Para cambiarla, vuelve a ejecutar el script: se cerrarán las sesiones abiertas. Hasta que la pongas, la API responde "Falta configurar la contraseña", así que nadie puede usarla.

   *Alternativa:* si algún día activas Cloudflare Zero Trust (pide tarjeta aunque el plan sea gratis), puedes usar Cloudflare Access en su lugar con `configurar-acceso.sh`: borra antes el secreto `APP_PASSWORD`, porque tiene prioridad.
7. **En el iPhone:** abre la web en Safari, inicia sesión con tu correo, y en *Compartir → Añadir a pantalla de inicio*.

Los nombres de menús del panel de Cloudflare cambian a veces; si no encuentras uno, busca la opción por su nombre en la documentación de Cloudflare.

## Añadir temas nuevos

1. Crea `public/content/topics/<id>.json` copiando la forma de uno existente (lección, `checks`, `practice` y `challenge` de al menos 5 ejercicios).
2. En `public/content/tree.json`, pon `"content": true` en ese tema.
3. Pasa el contenido por el verificador (/verificador-datos) antes de publicarlo: una respuesta "correcta" equivocada es el peor fallo posible en esta app.
4. Ejecuta `npm run check` y corrige lo que marque.
5. Cuando una respuesta guardada con "Mi respuesta también vale" sea correcta, añádela a `answers` en su ejercicio.

## Ajustes

| Dónde | Qué |
| --- | --- |
| `public/content/tree.json` → `threshold` | Porcentaje para superar un tema (0.8 = 80 %) |
| `public/content/shop.json` → `coins` | Monedas por acierto, reto, sesión y tema superado |
| `public/content/shop.json` → `items` | Objetos de la tienda y precios |
| `wrangler.toml` → `AI_DAILY_LIMIT` | Generaciones con IA por día |
| `wrangler.toml` → `GEMINI_MODEL` | Modelo de Gemini |

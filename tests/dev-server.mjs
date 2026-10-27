// Servidor local alternativo SIN dependencias (solo Node 22+), por si no puedes usar wrangler.
// Imita Cloudflare Pages: sirve /public, ejecuta /functions/api/* y simula D1 con SQLite.
// Uso: node tests/dev-server.mjs   →  http://localhost:8788
// Para probar de verdad en Cloudflare usa "npm run dev" (wrangler), que es lo recomendado.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { extname, join, normalize as normPath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');

// --- D1 simulado -----------------------------------------------------------
export function createD1(file = ':memory:') {
  const sqlite = new DatabaseSync(file);
  for (const f of readdirSync(join(ROOT, 'migrations')).sort()) {
    sqlite.exec(readFileSync(join(ROOT, 'migrations', f), 'utf8'));
  }
  class Stmt {
    constructor(sql, params = []) {
      this.sql = sql;
      this.params = params;
    }
    bind(...params) {
      return new Stmt(this.sql, params);
    }
    _exec() {
      const s = sqlite.prepare(this.sql);
      if (/^\s*(select|with)\b/i.test(this.sql) || /\breturning\b/i.test(this.sql)) {
        return { results: s.all(...this.params), meta: {} };
      }
      const r = s.run(...this.params);
      return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
    async first() {
      return this._exec().results[0] ?? null;
    }
    async all() {
      return this._exec();
    }
    async run() {
      return this._exec();
    }
  }
  return {
    prepare: (sql) => new Stmt(sql),
    async batch(stmts) {
      sqlite.exec('BEGIN');
      try {
        const out = stmts.map((s) => s._exec());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    sqlite,
  };
}

// --- Funciones de Pages -------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

async function serveStatic(pathname) {
  let p = normPath(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith('/')) p += 'index.html';
  const file = join(PUBLIC, p);
  if (!file.startsWith(PUBLIC)) return new Response('No', { status: 403 });
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error();
    return new Response(await readFile(file), { headers: { 'content-type': TYPES[extname(file)] || 'application/octet-stream' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

export function createHandler(env) {
  env.ASSETS = { fetch: (url) => serveStatic(new URL(url).pathname) };
  return async function handle(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return serveStatic(url.pathname);
    const name = url.pathname.slice(5).replace(/\/$/, '');
    if (!/^[a-z]+$/.test(name)) return new Response('Not found', { status: 404 });
    let mod;
    try {
      mod = await import(pathToFileURL(join(ROOT, 'functions/api', name + '.js')).href);
    } catch {
      return new Response(JSON.stringify({ error: 'Ruta desconocida' }), { status: 404 });
    }
    const method = request.method[0] + request.method.slice(1).toLowerCase();
    const handler = mod['onRequest' + method] || mod.onRequest;
    if (!handler) return new Response('Method not allowed', { status: 405 });
    const mw = await import(pathToFileURL(join(ROOT, 'functions/api/_middleware.js')).href);
    const context = { request, env, data: {}, params: {} };
    context.next = () => handler(context);
    return mw.onRequest(context);
  };
}

// --- Arranque -----------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = {
    DB: createD1(process.env.DB_FILE || join(ROOT, '.wrangler-local.sqlite')),
    DEV_EMAIL: process.env.DEV_EMAIL || 'local@example.com',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };
  const handle = createHandler(env);
  const port = Number(process.env.PORT || 8788);
  createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const response = await handle(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, () => console.log(`Curso Inglés en http://localhost:${port}`));
}

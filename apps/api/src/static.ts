import type { Context } from 'hono';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { extname, join, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};

/** Maps a URL path to a file inside `root`; never escapes `root` (works with Windows paths). */
function resolveFile(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const base = resolve(root);
  let abs = resolve(base, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  if (abs !== base && !abs.startsWith(base + sep)) return null;
  if (!existsSync(abs)) return null;
  let st = statSync(abs);
  if (st.isDirectory()) {
    abs = join(abs, 'index.html');
    if (!existsSync(abs)) return null;
    st = statSync(abs);
  }
  return st.isFile() ? abs : null;
}

function sendFile(c: Context, file: string, immutable: boolean): Response {
  const size = statSync(file).size;
  const headers: Record<string, string> = {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  let start = 0;
  let end = size - 1;
  let status = 200;
  // Range support lets phones seek in review videos.
  const range = c.req.header('range');
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && size > 0) {
    if (m[1] === '' && m[2] !== '') {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1] || 0);
      if (m[2] !== '') end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    }
    status = 206;
    headers['content-range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['content-length'] = String(size === 0 ? 0 : end - start + 1);
  if (c.req.method === 'HEAD' || size === 0) return new Response(null, { status, headers });
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(stream, { status, headers });
}

const HASHED = new RegExp(`\\${sep}(_expo|assets)\\${sep}`);

/**
 * Serves files from `root` for requests under `prefix`.
 * With `spa`, unknown paths without a file extension get index.html (client-side routes);
 * missing assets stay 404 so stale bundles fail loudly instead of loading HTML as JS.
 */
export function serveDir(c: Context, root: string, prefix: string, opts: { spa: boolean; immutable?: boolean }): Response {
  const urlPath = c.req.path.slice(prefix.length) || '/';
  const file = resolveFile(root, urlPath);
  if (file) return sendFile(c, file, opts.immutable ?? (HASHED.test(file) && !file.endsWith('.html')));
  if (opts.spa && !/\.[a-z0-9]{1,8}$/i.test(urlPath)) {
    const index = join(root, 'index.html');
    if (existsSync(index)) return sendFile(c, index, false);
    return c.html(
      `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px"><h2>Приложение ещё не собрано</h2><p>Запустите <code>pnpm build:web</code> или <code>start-server.bat</code>.</p></body>`,
      503,
    );
  }
  return c.text('Not found', 404);
}

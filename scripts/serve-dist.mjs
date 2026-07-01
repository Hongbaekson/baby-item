import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'dist');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

if (!existsSync(root)) {
  console.error('dist folder not found. Run npm run build first.');
  process.exit(1);
}

const resolveFile = (urlPath) => {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const requested = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = path.resolve(root, `.${requested}`);

  if (!filePath.startsWith(root)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return filePath;
  }

  return path.join(root, 'index.html');
};

const server = createServer((request, response) => {
  const filePath = resolveFile(request.url || '/');

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  response.writeHead(200, {
    'Content-Type': contentTypes.get(ext) || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port}`);
});

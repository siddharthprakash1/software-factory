// Minimal static file server for the demo site.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = import.meta.dirname;
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };

http
  .createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const file = path.join(root, path.normalize(url));
    if (!file.startsWith(root) || !fs.existsSync(file)) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'text/plain' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(4173, () => console.log('demo-site on http://localhost:4173'));

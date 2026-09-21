// Local development server: serves the static site and keeps the TMDB token out of browser JavaScript.
// Run: node local-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

// Read TMDB_READ_ACCESS_TOKEN from .env.local without adding any dependency.
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length && !key.trim().startsWith('#')) process.env[key.trim()] = value.join('=').trim();
  });
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const allowedEndpoints = [/^trending\/movie\/(day|week)$/, /^movie\/(popular|now_playing|upcoming)$/, /^tv\/popular$/, /^genre\/(movie|tv)\/list$/, /^discover\/(movie|tv)$/, /^search\/(movie|tv|multi)$/, /^movie\/\d+$/, /^tv\/\d+$/, /^tv\/\d+\/season\/\d+$/];

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost:3000');
  if (url.pathname === '/api/tmdb') {
    const endpoint = url.searchParams.get('endpoint');
    if (!endpoint || !allowedEndpoints.some(pattern => pattern.test(endpoint))) return response.writeHead(400).end(JSON.stringify({ error: 'Unsupported TMDB endpoint.' }));
    if (!process.env.TMDB_READ_ACCESS_TOKEN) return response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Add TMDB_READ_ACCESS_TOKEN to .env.local first.' }));
    url.searchParams.delete('endpoint');
    try {
      const tmdb = await fetch(`https://api.themoviedb.org/3/${endpoint}?${url.searchParams}`, { headers: { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`, accept: 'application/json' } });
      const body = await tmdb.text();
      response.writeHead(tmdb.status, { 'Content-Type': 'application/json' }).end(body);
    } catch { response.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Could not reach TMDB.' })); }
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.normalize(path.join(__dirname, requested));
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end('Not found');
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

// If port 3000 is taken (for example by another dev server), try the next port automatically.
function startServer(port) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy; trying ${port + 1}…`);
      startServer(port + 1);
    } else {
      throw error;
    }
  });
  server.listen(port, () => console.log(`Reelhouse is running at http://localhost:${port}`));
}

startServer(Number(process.env.PORT) || 3000);

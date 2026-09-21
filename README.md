# Reelhouse + TMDB

This plain HTML, CSS, and JavaScript catalog uses one small Vercel function at `api/tmdb.js` so the TMDB credential stays server-side.

## Configure TMDB safely

1. Create a TMDB API **Read Access Token** (bearer token).
2. In Vercel: project **Settings** → **Environment Variables**, add `TMDB_READ_ACCESS_TOKEN` with that token for the environments you deploy.
3. Redeploy. The browser calls `/api/tmdb`; only the serverless function forwards the secret token to TMDB.

## Run locally with the API — no Vercel needed

Opening `index.html` directly as a `file://` page cannot run `/api/tmdb`. This project includes `local-server.js`, a tiny local-only server that serves the site and secure TMDB proxy together:

```powershell
# Create .env.local from .env.example and add your real token locally
Copy-Item .env.example .env.local

# Start the static site and the /api/tmdb function together
node local-server.js
```

Then open `http://localhost:3000`. The website and API are served from the same origin, so real TMDB requests work locally without exposing the token in browser code. Never commit `.env.local`.

## Deploy

Import this folder into Vercel (or run `vercel`), add the environment variable above, then deploy. Static pages are served normally and Vercel automatically serves `api/tmdb.js` at `/api/tmdb`.

TMDB attribution: This product uses the TMDB API but is not endorsed or certified by TMDB.

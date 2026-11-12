# Zanora

Zanora is a movie and TV discovery website built with plain HTML, CSS, and JavaScript. It uses The Movie Database (TMDB) API for movie and television metadata, search, artwork, and related information.

The project uses a lightweight Vercel serverless function at `api/tmdb.js` to keep the TMDB API credential server-side.

## TMDB Configuration

1. Create a TMDB API **Read Access Token** (Bearer token).
2. Open your Vercel project → **Settings** → **Environment Variables**.
3. Add an environment variable named `TMDB_READ_ACCESS_TOKEN` and paste your token as its value.
4. Redeploy your project.

The browser sends requests to `/api/tmdb`, and the serverless function forwards them to TMDB using the private token.

## Run Locally

Opening `index.html` directly using `file://` will not work with the `/api/tmdb` endpoint.

To run the website locally with working TMDB requests, use the included `local-server.js`:

```powershell
# Create .env.local from the example file
Copy-Item .env.example .env.local

# Add your TMDB Read Access Token to .env.local

# Start the local server
node local-server.js
```

Open the website at:

`http://localhost:3000`

The local server serves the website and TMDB proxy from the same origin, allowing TMDB requests to work without exposing the API token in browser code.

**Never commit `.env.local` or publish your API token.**

## Deployment

1. Import the project repository into Vercel.
2. Add `TMDB_READ_ACCESS_TOKEN` under **Settings → Environment Variables**.
3. Deploy the project.

Vercel serves the static website and automatically handles the serverless function at `/api/tmdb`.

## Copyright and Attribution

Zanora is an independent project and is not affiliated with or endorsed by TMDB.

This product uses the TMDB API but is not endorsed or certified by TMDB.

Movie and television metadata and artwork are provided by TMDB and remain subject to their respective rights and terms.
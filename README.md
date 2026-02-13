# Creativ44

Creativ44 is a browser voxel game with:
- singleplayer worlds (normal/flat, seeds)
- portals between worlds
- runtime modding
- live multiplayer (host/join by code)

## Local run

### Game only
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.

### Netlify-style local run (with functions)
```bash
npm install
npm run dev:netlify
```
Open `http://localhost:8888`.

## Deploy to Netlify

This repo is already configured for Netlify:
- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`
- SPA redirect enabled in `netlify.toml`

### Steps
1. Push this repo to GitHub/GitLab/Bitbucket.
2. Create a new Netlify site from that repo.
3. Build settings (should auto-detect from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy.

## Multiplayer backend

Multiplayer endpoint:
- `/.netlify/functions/multiplayer`

Storage:
- Uses Netlify Blobs when available (persistent across function instances).
- Falls back to in-memory storage if blobs are unavailable.

## Quick production check

After deploy, open:
- `https://<your-site>.netlify.app/.netlify/functions/multiplayer?action=pull`

You should get JSON (error JSON is fine), not HTML.

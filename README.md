# Meeting Notes Cloudflare PWA

> **Cloudflare edition** of [meeting-notes](https://github.com/nikkimasani/meeting-notes) · Live: https://meeting-notes-cloudflare.pages.dev

Cloudflare Pages deployment of the Meeting Notes workspace.

This repository mirrors the enhanced Meeting Notes interface with mobile recording safeguards, speaker-aware transcripts, summaries, action items, meeting organization, analytics, backups, archive recovery, follow-up drafts, and rich exports.

## Deployment

GitHub Actions builds with `npm run build` and publishes `dist` to the `meeting-notes-cloudflare` Pages project.

Cloudflare Pages Functions proxy `/api/*` requests to the secured Vercel server functions. The OpenAI key remains server-side and is never included in the browser bundle.

## Run locally

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build into dist/
```

## Project layout

| Path | What it does |
|---|---|
| `src/main.tsx` | The whole app UI |
| `src/recording-store.ts` | Local storage of recordings so mobile captures survive interruptions |
| `src/styles.css`, `src/mobile.css` | Styles |
| `functions/api/[[path]].js` | Pages Function proxying `/api/*` to the Vercel server functions |
| `.github/workflows/deploy-cloudflare-pages.yml` | Build and deploy on push |
| `DESIGN_REVIEW.md` | Design review notes |

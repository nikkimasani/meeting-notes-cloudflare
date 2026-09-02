# Meeting Notes Cloudflare PWA

Cloudflare Pages deployment of the Meeting Notes workspace.

This repository mirrors the enhanced Meeting Notes interface with mobile recording safeguards, speaker-aware transcripts, summaries, action items, meeting organization, analytics, backups, archive recovery, follow-up drafts, and rich exports.

## Deployment

GitHub Actions builds with `npm run build` and publishes `dist` to the `meeting-notes-cloudflare` Pages project.

Cloudflare Pages Functions proxy `/api/*` requests to the secured Vercel server functions. The OpenAI key remains server-side and is never included in the browser bundle.

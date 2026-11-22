# Said & Done v3: Otter-style rebuild (November 2026)

## Why the rebuild
The previous app decoded whole recordings on the phone after you pressed Stop. On iPhone that
step crashed (memory) or silently read only the first 5 seconds (Safari's fragmented-MP4 bug),
so meetings never reached a transcript, summary, or chat. The server was fine the whole time.

## How it works now
- **Live transcription.** The microphone is captured as raw 16 kHz audio and cut at natural pauses
  into 15–35 s pieces. Each piece is saved to the phone *before* it's sent, then transcribed with
  speaker labels while you keep talking. Short voice samples of each speaker are sent with later
  pieces so "Speaker 1" stays Speaker 1.
- **Nothing gets lost.** The piece in progress is checkpointed every 5 s. If the app is closed,
  the next launch turns the checkpoint into a piece and finishes. Offline? Pieces queue and send
  on reconnect, with retries and back-off.
- **Notes.** When transcription finishes, `/api/notes` writes an Otter-style title, summary,
  timestamped outline, action items, decisions, and open questions. `/api/chat` answers per meeting
  or across the whole library, citing timestamps.
- **Export everything.** One ZIP per meeting (summary, transcript, SRT/VTT captions, highlights,
  notes, AI chat, Word, PDF, JSON, audio), individual formats, and a whole-library ZIP. On iPhone,
  the share sheet saves straight to Google Drive or Files.

## Visual identity: "highlighter on paper"
Warm paper and ink; one electric highlighter (#E2FF3D) for highlights, active tabs, and titles;
a red record dot. Funnel Display / Funnel Sans and JetBrains Mono for timestamps, all bundled for
offline use. Rules and type structure the page instead of stacks of rounded cards. Real waveforms
appear on every meeting and in the player. In dark mode the highlighter becomes an underline
wherever text is light.

## Code map
`src/lib`: storage (IndexedDB), recorder, transcription queue, importer, migration, AI, export.
`src/ui`: Home, Record, Meeting (Summary/Transcript/Highlights/Chat/Notes + player), Ask, Settings.
Server endpoints live in the `meeting-notes` (Vercel) repo; `/api/health?deep=1` runs a live self-test.

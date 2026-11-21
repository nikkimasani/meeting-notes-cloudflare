# Said and Done — Design System (v2, November 2026)

## Direction

Calm "ink and paper" surfaces, one confident blue for interaction, and coral reserved for
recording so the most important action is always unmistakable. Meeting titles and page
headings use an editorial serif (Instrument Serif) for character; everything else uses
Geist for clarity. Fonts are bundled with the app, so it looks right offline.

## Tokens

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#f5f4f0` | `#0c0e12` |
| Surface | `#ffffff` | `#15181e` |
| Text | `#16171b` | `#ecedf0` |
| Muted | `#676a72` | `#9a9ea8` |
| Accent (interactive) | `#3463f5` | `#6a8fff` |
| Record | `#ef4f35` | `#ff6448` |
| Radius | 10 / 14 / 20 px | same |

System, Light and Dark appearance are supported; System follows the device.

## Structure

- **Phone:** large serif page title, grouped conversation cards (time, title, two-line summary,
  status and task badges), an "Up next" card for the next scheduled meeting, and bottom
  navigation with a raised coral record button. Tasks can be completed straight from the
  Tasks tab.
- **Meeting:** title and meta line, then the recording card (playback, scrubber, transcription
  status and progress, one clear Transcribe action), then Summary → Action items →
  Key points/Decisions → Ask → Transcript → Follow-up → Tags → Details. On wide screens
  action items, tags, follow-up and details sit in a right-hand column.
- **Record:** a dedicated, distraction-free screen on every device: consent check,
  big timer, animated rings while live, Pause/Stop.
- **Feedback:** progress, errors and confirmations appear in a floating status dock that is
  always visible, instead of a banner at the top of a long page.

## Accessibility

44 px touch targets on phone, visible focus rings, `aria-pressed` on toggles,
`aria-current` on navigation, reduced-motion support, and 16 px inputs on phone to prevent
iOS zoom.

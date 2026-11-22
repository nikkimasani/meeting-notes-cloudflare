import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  MoreHorizontal,
  Star,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Sparkles,
  Highlighter,
  MessageSquare,
  Copy,
  Pencil,
  Send,
  Search,
  Trash2,
  Users,
  AudioLines,
  Check,
  X,
} from "lucide-react";
import { store, useMeeting, uid } from "../lib/store";
import { askMeeting, generateNotes, isGeneratingNotes, speakerName } from "../lib/ai";
import { playbackBlob } from "../lib/export";
import { processStoredAudio } from "../lib/importer";
import { transcriber } from "../lib/transcriber";
import { recorder } from "../lib/recorder";
import type { Meeting, Segment } from "../lib/types";
import {
  Avatar,
  Empty,
  Sheet,
  Waveform,
  back,
  clock,
  go,
  minutes,
  statusText,
  toast,
  useImportProgress,
  usePieceStats,
  useTick,
  type Tab,
} from "./kit";
import { ExportSheet } from "./ExportSheet";

// ---------- Player ----------
function usePlayer(m: Meeting | undefined) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const ready = !!m && m.status !== "recording" && (m.hasPcm || m.audioFiles.length > 0);
  const version = m ? `${m.id}:${m.status}:${m.duration > 0}` : "";
  useEffect(() => {
    if (!m || !ready) return;
    let alive = true;
    let made: string | null = null;
    void playbackBlob(m).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [version, ready]);
  useEffect(() => {
    const el = new Audio();
    el.preload = "metadata";
    audio.current = el;
    const onTime = () => setTime(el.currentTime);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", () => setPlaying(true));
    el.addEventListener("pause", () => setPlaying(false));
    el.addEventListener("ended", () => setPlaying(false));
    return () => {
      el.pause();
      el.src = "";
    };
  }, []);
  useEffect(() => {
    if (audio.current && url) {
      const t = audio.current.currentTime;
      audio.current.src = url;
      audio.current.currentTime = t;
      audio.current.playbackRate = rate;
    }
  }, [url]);
  const seek = useCallback((t: number, play = true) => {
    const el = audio.current;
    if (!el || !el.src) return;
    el.currentTime = Math.max(0, t);
    setTime(el.currentTime);
    if (play) void el.play().catch(() => {});
  }, []);
  return {
    available: !!url,
    time,
    playing,
    rate,
    seek,
    toggle: () => {
      const el = audio.current;
      if (!el?.src) return;
      if (el.paused) void el.play().catch(() => toast("Playback could not start.", "error"));
      else el.pause();
    },
    skip: (d: number) => seek((audio.current?.currentTime || 0) + d, !audio.current?.paused),
    setRate: (r: number) => {
      setRate(r);
      if (audio.current) audio.current.playbackRate = r;
    },
  };
}
type Player = ReturnType<typeof usePlayer>;

export function MeetingScreen({ id, tab }: { id: string; tab: Tab }) {
  const m = useMeeting(id);
  const player = usePlayer(m);
  const stats = usePieceStats(m);
  const importing = useImportProgress(id);
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [speakersOpen, setSpeakersOpen] = useState(false);
  useTick(1000, !!m && isGeneratingNotes(m.id));
  const liveHere = !!m && m.status === "recording" && recorder.snap.meetingId === m.id;
  useEffect(() => {
    if (liveHere) go("record", true);
  }, [liveHere]);

  if (!m)
    return (
      <div className="pad">
        <Empty icon={<AudioLines />} title="Meeting not found" body="It may have been deleted." action={<button className="btn btn-ink" onClick={() => go("", true)}>Go home</button>} />
      </div>
    );
  if (liveHere) return null;
  const setTab = (t: Tab) => go(`m/${m.id}${t === "summary" ? "" : "?tab=" + t}`, true);
  const hlCount = m.segments.filter((s) => s.highlight || s.comment).length;
  const status = statusText(m, stats, importing);
  const del = async () => {
    if (!confirm(`Delete “${m.title}”? This removes its audio, transcript and notes from this device.`)) return;
    await store.remove(m.id);
    toast("Meeting deleted");
    go("", true);
  };

  return (
    <div className={`meeting ${player.available ? "has-player" : ""}`}>
      <header className="bar meeting-bar">
        <button className="back" onClick={() => back("")}>
          <ChevronLeft /> <span>Meetings</span>
        </button>
        <div className="bar-actions">
          <button className="icon-btn" aria-label={m.starred ? "Unstar" : "Star"} aria-pressed={m.starred} onClick={() => store.update(m.id, { starred: !m.starred })}>
            <Star className={m.starred ? "star-on" : ""} />
          </button>
          <button className="btn btn-ink btn-sm" onClick={() => setExportOpen(true)}>
            <Download /> Export
          </button>
          <button className="icon-btn" aria-label="More" onClick={() => setMoreOpen(true)}>
            <MoreHorizontal />
          </button>
        </div>
      </header>

      <div className="meeting-head">
        <textarea
          className="meeting-title"
          rows={1}
          aria-label="Title"
          value={m.title}
          onChange={(e) => store.update(m.id, { title: e.target.value.replace(/\n/g, " "), titleIsAuto: false }, { debounce: true })}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }
          }}
        />
        <div className="meeting-meta">
          <span>{new Date(m.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          {m.duration > 0 && <span>{minutes(m.duration)}</span>}
          {Object.keys(m.speakers).length > 0 && (
            <button className="meta-link" onClick={() => setSpeakersOpen(true)}>
              <Users /> {Object.keys(m.speakers).length} speaker{Object.keys(m.speakers).length === 1 ? "" : "s"}
            </button>
          )}
        </div>
        <StatusBanner m={m} status={status} stats={stats} />
      </div>

      <nav className="tabs" role="tablist">
        {(
          [
            ["summary", "Summary"],
            ["transcript", "Transcript"],
            ["highlights", `Highlights${hlCount ? " " + hlCount : ""}`],
            ["chat", "Chat"],
            ["notes", "Notes"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === "summary" && <SummaryTab m={m} player={player} />}
        {tab === "transcript" && <TranscriptTab m={m} player={player} />}
        {tab === "highlights" && <HighlightsTab m={m} player={player} />}
        {tab === "chat" && <ChatTab m={m} />}
        {tab === "notes" && <NotesTab m={m} />}
      </div>

      {player.available && <PlayerBar m={m} player={player} />}

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} meetings={[m]} />
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Meeting">
        <div className="menu-list">
          <button
            disabled={!m.segments.length || isGeneratingNotes(m.id)}
            onClick={() => {
              setMoreOpen(false);
              void generateNotes(m.id);
              setTab("summary");
            }}
          >
            <Sparkles /> Rewrite summary and outline
          </button>
          <button onClick={() => (setMoreOpen(false), setSpeakersOpen(true))} disabled={!Object.keys(m.speakers).length}>
            <Users /> Rename speakers
          </button>
          {m.audioFiles.length > 0 && !m.hasPcm && (
            <button onClick={() => (setMoreOpen(false), void processStoredAudio(m.id))}>
              <AudioLines /> Transcribe audio again
            </button>
          )}
          <button className="danger" onClick={() => (setMoreOpen(false), void del())}>
            <Trash2 /> Delete meeting
          </button>
        </div>
      </Sheet>
      <SpeakersSheet m={m} open={speakersOpen} onClose={() => setSpeakersOpen(false)} />
    </div>
  );
}

function StatusBanner({ m, status, stats }: { m: Meeting; status: string; stats: ReturnType<typeof usePieceStats> }) {
  if (m.status === "needs_audio_processing")
    return (
      <div className="banner">
        <span>This recording hasn't been transcribed yet.</span>
        <button className="btn btn-ink btn-sm" onClick={() => void processStoredAudio(m.id)}>
          Transcribe now
        </button>
      </div>
    );
  if (m.status === "error")
    return (
      <div className="banner banner-warn">
        <span>{m.error || "Something went wrong."}</span>
        <button
          className="btn btn-ink btn-sm"
          onClick={() => (m.hasPcm ? void transcriber.retry(m.id) : void processStoredAudio(m.id))}
        >
          Retry
        </button>
      </div>
    );
  if (m.status === "processing" || status)
    return status ? (
      <div className="banner banner-busy">
        <span className="spinner" />
        <span>{status}</span>
        {stats && stats.total > 0 && (
          <span className="progress">
            <i style={{ width: `${(stats.done / stats.total) * 100}%` }} />
          </span>
        )}
      </div>
    ) : null;
  return null;
}

// ---------- Summary ----------
function SummaryTab({ m, player }: { m: Meeting; player: Player }) {
  const n = m.notes;
  const busy = isGeneratingNotes(m.id);
  if (!n) {
    return (
      <div className="pad">
        {busy ? (
          <div className="writing">
            <span className="spinner" /> Writing your summary, outline and action items…
          </div>
        ) : m.notesError ? (
          <Empty icon={<Sparkles />} title="No summary yet" body={m.notesError} action={m.segments.length ? <button className="btn btn-ink" onClick={() => void generateNotes(m.id)}>Try again</button> : undefined} />
        ) : m.segments.length && m.status === "ready" ? (
          <Empty icon={<Sparkles />} title="No summary yet" body="Turn the transcript into a summary, outline, and action items." action={<button className="btn btn-ink" onClick={() => void generateNotes(m.id)}>Generate summary</button>} />
        ) : (
          <Empty icon={<Sparkles />} title="Summary on its way" body="Your summary, outline, and action items appear here as soon as transcription finishes." />
        )}
      </div>
    );
  }
  const toggle = (id: string) =>
    store.update(m.id, (x) => ({ notes: x.notes && { ...x.notes, actions: x.notes.actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) } }));
  const editAction = (id: string, task: string) =>
    store.update(m.id, (x) => ({ notes: x.notes && { ...x.notes, actions: x.notes.actions.map((a) => (a.id === id ? { ...a, task } : a)) } }), { debounce: true });
  const removeAction = (id: string) =>
    store.update(m.id, (x) => ({ notes: x.notes && { ...x.notes, actions: x.notes.actions.filter((a) => a.id !== id) } }));
  const addAction = () =>
    store.update(m.id, (x) => ({ notes: x.notes && { ...x.notes, actions: [...x.notes.actions, { id: uid(), task: "", owner: null, due: null, start: null, done: false }] } }));
  const Stamp = ({ t }: { t: number | null }) =>
    t === null || t === undefined ? null : (
      <button className="stamp mono" onClick={() => player.seek(t)} disabled={!player.available} aria-label={`Play from ${clock(t)}`}>
        {clock(t)}
      </button>
    );
  return (
    <div className="pad summary">
      {busy && (
        <div className="writing small">
          <span className="spinner" /> Updating…
        </div>
      )}
      <section className="block">
        <h3 className="kicker">Overview</h3>
        <textarea
          className="prose"
          value={n.summary}
          aria-label="Summary"
          onChange={(e) => store.update(m.id, (x) => ({ notes: x.notes && { ...x.notes, summary: e.target.value } }), { debounce: true })}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }
          }}
        />
      </section>

      <section className="block">
        <div className="block-head">
          <h3 className="kicker">Action items</h3>
          <button className="link" onClick={addAction}>
            + Add
          </button>
        </div>
        {n.actions.length ? (
          <ul className="tasks">
            {n.actions.map((a) => (
              <li key={a.id} className={a.done ? "done" : ""}>
                <button className="task-box" aria-label={a.done ? "Mark not done" : "Mark done"} aria-pressed={a.done} onClick={() => toggle(a.id)}>
                  {a.done && <Check />}
                </button>
                <div className="task-main">
                  <input value={a.task} placeholder="New task" aria-label="Task" onChange={(e) => editAction(a.id, e.target.value)} />
                  <div className="task-meta">
                    {a.owner && <span className="chip">@{a.owner}</span>}
                    {a.due && <span className="chip">Due {a.due}</span>}
                    <Stamp t={a.start} />
                  </div>
                </div>
                <button className="icon-btn subtle" aria-label="Remove task" onClick={() => removeAction(a.id)}>
                  <X />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet-note">No action items were mentioned.</p>
        )}
      </section>

      {n.outline.length > 0 && (
        <section className="block">
          <h3 className="kicker">Outline</h3>
          <ol className="outline">
            {n.outline.map((s, i) => (
              <li key={i}>
                <div className="outline-head">
                  <b>{s.heading}</b>
                  <Stamp t={s.start} />
                </div>
                <ul>
                  {s.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {n.decisions.length > 0 && (
        <section className="block">
          <h3 className="kicker">Decisions</h3>
          <ul className="plain">
            {n.decisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      {n.openQuestions.length > 0 && (
        <section className="block">
          <h3 className="kicker">Open questions</h3>
          <ul className="plain">
            {n.openQuestions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      <TagEditor m={m} />
    </div>
  );
}

function TagEditor({ m }: { m: Meeting }) {
  const [draft, setDraft] = useState("");
  return (
    <section className="block tags-block">
      <h3 className="kicker">Tags</h3>
      <div className="tags">
        {m.tags.map((t) => (
          <span key={t} className="tag">
            #{t}
            <button aria-label={`Remove ${t}`} onClick={() => store.update(m.id, { tags: m.tags.filter((x) => x !== t) })}>
              <X />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim().replace(/^#/, "");
            if (t && !m.tags.some((x) => x.toLowerCase() === t.toLowerCase())) store.update(m.id, { tags: [...m.tags, t] });
            setDraft("");
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="+ tag" aria-label="Add tag" />
        </form>
      </div>
    </section>
  );
}

// ---------- Transcript ----------
function TranscriptTab({ m, player }: { m: Meeting; player: Player }) {
  const [q, setQ] = useState("");
  const [follow, setFollow] = useState(true);
  const [active, setActive] = useState<Segment | null>(null);
  const activeId = useMemo(() => {
    if (!player.playing && player.time === 0) return null;
    let found: string | null = null;
    for (const s of m.segments) if (s.start <= player.time + 0.2) found = s.id;
    return found;
  }, [player.time, m.segments, player.playing]);
  useEffect(() => {
    if (!follow || !activeId || !player.playing) return;
    document.getElementById("seg-" + activeId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId, follow, player.playing]);
  const shown = q.trim() ? m.segments.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())) : m.segments;
  if (!m.segments.length)
    return (
      <div className="pad">
        <Empty icon={<AudioLines />} title={m.status === "processing" ? "Transcribing…" : "No transcript"} body={m.status === "processing" ? "Lines appear here as each part finishes." : "There's no speech in this meeting yet."} />
      </div>
    );
  return (
    <div className="pad transcript">
      <div className="transcript-tools">
        <div className="search small">
          <Search />
          <input type="search" placeholder="Find in transcript" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find in transcript" />
        </div>
        {player.available && (
          <label className="follow">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow audio
          </label>
        )}
      </div>
      {q && <p className="quiet-note">{shown.length} match{shown.length === 1 ? "" : "es"}</p>}
      <div className="lines">
        {shown.map((s, i) => {
          const prev = shown[i - 1];
          const same = !q && prev && prev.speaker === s.speaker && s.start - prev.end < 30;
          return (
            <div key={s.id} id={"seg-" + s.id} className={`line ${same ? "cont" : ""} ${s.id === activeId ? "now" : ""} ${s.highlight ? "is-hl" : ""}`}>
              {!same && (
                <div className="line-who">
                  <Avatar id={s.speaker} name={speakerName(m, s.speaker)} size={28} />
                  <b>{speakerName(m, s.speaker)}</b>
                  <button className="stamp mono" onClick={() => player.seek(s.start)} disabled={!player.available}>
                    {clock(s.start)}
                  </button>
                </div>
              )}
              <div className="line-body">
                <p onClick={() => player.available && player.seek(s.start)}>
                  <span className="mark">{q ? highlightText(s.text, q) : s.text}</span>
                </p>
                <button className="line-more" aria-label="Line options" onClick={() => setActive(s)}>
                  <MoreHorizontal />
                </button>
              </div>
              {s.comment && (
                <div className="comment">
                  <MessageSquare /> {s.comment}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SegmentSheet m={m} seg={active} onClose={() => setActive(null)} player={player} />
    </div>
  );
}

function highlightText(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function SegmentSheet({ m, seg, onClose, player }: { m: Meeting; seg: Segment | null; onClose: () => void; player: Player }) {
  const [mode, setMode] = useState<"menu" | "comment" | "edit" | "speaker">("menu");
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setMode("menu");
  }, [seg?.id]);
  if (!seg) return null;
  const patch = (p: Partial<Segment>) => store.update(m.id, (x) => ({ segments: x.segments.map((s) => (s.id === seg.id ? { ...s, ...p } : s)) }));
  return (
    <Sheet open={!!seg} onClose={onClose} title={`${speakerName(m, seg.speaker)} · ${clock(seg.start)}`}>
      <blockquote className="sheet-quote">{seg.text}</blockquote>
      {mode === "menu" && (
        <div className="menu-list">
          {player.available && (
            <button onClick={() => (player.seek(seg.start), onClose())}>
              <Play /> Play from here
            </button>
          )}
          <button onClick={() => (patch({ highlight: !seg.highlight }), toast(seg.highlight ? "Highlight removed" : "Highlighted"), onClose())}>
            <Highlighter /> {seg.highlight ? "Remove highlight" : "Highlight"}
          </button>
          <button onClick={() => (setDraft(seg.comment || ""), setMode("comment"))}>
            <MessageSquare /> {seg.comment ? "Edit comment" : "Add comment"}
          </button>
          <button onClick={() => (setDraft(speakerName(m, seg.speaker)), setMode("speaker"))}>
            <Users /> Rename {speakerName(m, seg.speaker)}
          </button>
          <button onClick={() => (setDraft(seg.text), setMode("edit"))}>
            <Pencil /> Edit text
          </button>
          <button onClick={() => void navigator.clipboard.writeText(`${speakerName(m, seg.speaker)} (${clock(seg.start)}): ${seg.text}`).then(() => (toast("Copied"), onClose()))}>
            <Copy /> Copy
          </button>
        </div>
      )}
      {mode !== "menu" && (
        <form
          className="sheet-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "comment") patch({ comment: draft.trim() || undefined });
            if (mode === "edit" && draft.trim()) patch({ text: draft.trim() });
            if (mode === "speaker" && draft.trim()) store.update(m.id, (x) => ({ speakers: { ...x.speakers, [seg.speaker]: draft.trim() } }));
            onClose();
          }}
        >
          {mode === "speaker" ? (
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Speaker name" placeholder="Name" />
          ) : (
            <textarea autoFocus rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={mode === "comment" ? "Write a comment" : ""} aria-label={mode} />
          )}
          <div className="sheet-actions">
            <button type="button" className="btn btn-quiet" onClick={() => setMode("menu")}>
              Cancel
            </button>
            <button className="btn btn-ink">Save</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function SpeakersSheet({ m, open, onClose }: { m: Meeting; open: boolean; onClose: () => void }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of m.segments) c[s.speaker] = (c[s.speaker] || 0) + (s.end - s.start);
    return c;
  }, [m.segments]);
  return (
    <Sheet open={open} onClose={onClose} title="Speakers">
      <p className="sheet-note">Names apply everywhere in this meeting, including exports and AI chat.</p>
      <div className="speaker-list">
        {Object.keys(m.speakers).map((id) => (
          <label key={id} className="speaker-row">
            <Avatar id={id} name={speakerName(m, id)} size={34} />
            <input
              value={m.speakers[id]}
              aria-label={`Name for ${id}`}
              onChange={(e) => store.update(m.id, (x) => ({ speakers: { ...x.speakers, [id]: e.target.value } }), { debounce: true })}
            />
            <span className="mono quiet">{minutes(counts[id] || 0) || "—"}</span>
          </label>
        ))}
      </div>
      <button className="btn btn-ink btn-block" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}

// ---------- Highlights ----------
function HighlightsTab({ m, player }: { m: Meeting; player: Player }) {
  const list = m.segments.filter((s) => s.highlight || s.comment);
  if (!list.length)
    return (
      <div className="pad">
        <Empty icon={<Highlighter />} title="No highlights yet" body="Tap ⋯ on any transcript line to highlight it or add a comment. While recording, tap Highlight to mark the moment." action={<button className="btn btn-quiet" onClick={() => go(`m/${m.id}?tab=transcript`, true)}>Open transcript</button>} />
      </div>
    );
  return (
    <div className="pad">
      <ul className="hl-list">
        {list.map((s) => (
          <li key={s.id}>
            <button className="hl-card" onClick={() => player.seek(s.start)} disabled={!player.available}>
              <div className="line-who">
                <Avatar id={s.speaker} name={speakerName(m, s.speaker)} size={24} />
                <b>{speakerName(m, s.speaker)}</b>
                <span className="mono quiet">{clock(s.start)}</span>
              </div>
              <p>{s.highlight ? <span className="mark">{s.text}</span> : s.text}</p>
              {s.comment && (
                <div className="comment">
                  <MessageSquare /> {s.comment}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Chat ----------
function ChatTab({ m }: { m: Meeting }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [m.chat.length, busy]);
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setDraft("");
    setBusy(true);
    await askMeeting(m.id, q.trim());
    setBusy(false);
  };
  if (!m.segments.length)
    return (
      <div className="pad">
        <Empty icon={<MessageSquare />} title="Chat opens after transcription" body="Once there's a transcript you can ask anything about this meeting." />
      </div>
    );
  const firstSpeaker = speakerName(m, m.segments[0]?.speaker || "S1");
  const suggestions = ["What are my action items?", "Draft a follow-up email", "What were the key decisions?", `What did ${firstSpeaker} say?`];
  return (
    <div className="pad chat">
      {m.chat.length === 0 && (
        <div className="chat-intro">
          <p>Ask anything about this meeting. Answers cite the moment in the recording.</p>
          <div className="suggest">
            {suggestions.map((s) => (
              <button key={s} onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="msgs">
        {m.chat.map((c, i) => (
          <div key={i} className={`msg msg-${c.role}`}>
            {c.role === "assistant" ? <RichText text={c.content} /> : c.content}
            {c.role === "assistant" && (
              <button className="msg-copy" aria-label="Copy answer" onClick={() => void navigator.clipboard.writeText(c.content).then(() => toast("Copied"))}>
                <Copy />
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div className="msg msg-assistant typing">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        <div ref={end} />
      </div>
      {m.chat.length > 0 && (
        <button className="link clear-chat" onClick={() => confirm("Clear this chat?") && store.update(m.id, { chat: [] })}>
          Clear chat
        </button>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this meeting" aria-label="Ask about this meeting" />
        <button className="send" disabled={!draft.trim() || busy} aria-label="Send">
          <Send />
        </button>
      </form>
    </div>
  );
}

/** Minimal formatting for AI answers: paragraphs, bullets, bold. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part));
  return (
    <div className="rich">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ---------- Notes ----------
function NotesTab({ m }: { m: Meeting }) {
  return (
    <div className="pad notes">
      <textarea
        className="notes-area"
        value={m.userNotes}
        placeholder="Your own notes. They're included in exports and the AI can use them when you chat."
        onChange={(e) => store.update(m.id, { userNotes: e.target.value }, { debounce: true })}
        aria-label="Your notes"
      />
      <p className="quiet-note">Saved automatically.</p>
    </div>
  );
}

// ---------- Player bar ----------
function PlayerBar({ m, player }: { m: Meeting; player: Player }) {
  const rates = [1, 1.25, 1.5, 2, 0.75];
  const dur = m.duration || 1;
  return (
    <div className="player">
      <Waveform peaks={m.peaks} bars={140} height={34} progress={player.time / dur} onSeek={(f) => player.seek(f * dur, player.playing)} className="player-wave" />
      <div className="player-row">
        <span className="mono player-time">{clock(player.time)}</span>
        <div className="player-buttons">
          <button className="icon-btn" aria-label="Back 15 seconds" onClick={() => player.skip(-15)}>
            <RotateCcw />
          </button>
          <button className="play" aria-label={player.playing ? "Pause" : "Play"} onClick={player.toggle}>
            {player.playing ? <Pause /> : <Play />}
          </button>
          <button className="icon-btn" aria-label="Forward 15 seconds" onClick={() => player.skip(15)}>
            <RotateCw />
          </button>
        </div>
        <button className="rate mono" aria-label="Playback speed" onClick={() => player.setRate(rates[(rates.indexOf(player.rate) + 1) % rates.length])}>
          {player.rate}×
        </button>
      </div>
    </div>
  );
}

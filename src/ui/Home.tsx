import { useMemo, useState } from "react";
import { Search, Upload, Star, X, MessageCircle, Sparkles, Mic } from "lucide-react";
import { useMeetings } from "../lib/store";
import { importFile } from "../lib/importer";
import { speakerName } from "../lib/ai";
import type { Meeting } from "../lib/types";
import {
  Empty,
  Waveform,
  dayLabel,
  go,
  minutes,
  statusText,
  timeOf,
  toast,
  useImportProgress,
  usePieceStats,
} from "./kit";
import { useRecorder } from "./Rail";

export function Home() {
  const meetings = useMeetings();
  const rec = useRecorder();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<"all" | "starred" | "tasks">("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((m) => {
      if (filter === "starred" && !m.starred) return false;
      if (filter === "tasks" && !m.notes?.actions.some((a) => !a.done)) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.notes?.summary || "").toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)) ||
        m.segments.some((s) => s.text.toLowerCase().includes(q)) ||
        m.userNotes.toLowerCase().includes(q)
      );
    });
  }, [meetings, query, filter]);

  const groups = useMemo(() => {
    const out: [string, Meeting[]][] = [];
    for (const m of visible) {
      const label = dayLabel(m.createdAt);
      const last = out[out.length - 1];
      if (last && last[0] === label) last[1].push(m);
      else out.push([label, [m]]);
    }
    return out;
  }, [visible]);

  const openTasks = meetings.reduce((n, m) => n + (m.notes?.actions.filter((a) => !a.done).length || 0), 0);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) return toast("That file is over 500 MB. Trim it and try again.", "error");
    const id = await importFile(file);
    toast("Importing — transcription starts in a moment");
    go("m/" + id + "?tab=transcript");
  };

  return (
    <div className="home">
      <header className="home-head">
        <div className="home-brand">
          <img src="/saiddone-mark.png" alt="" />
          <span>Said &amp; Done</span>
        </div>
        <div className="home-tools">
          <button className="icon-btn" aria-label="Search" onClick={() => setSearching((s) => !s)}>
            {searching ? <X /> : <Search />}
          </button>
          <label className="icon-btn" aria-label="Import audio or video" title="Import audio or video">
            <Upload />
            <input type="file" accept="audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mov,.webm" onChange={onImport} />
          </label>
        </div>
      </header>

      <h1 className="page-title">
        <span className="hl">Meetings</span>
      </h1>

      {(searching || query) && (
        <div className="search">
          <Search />
          <input
            autoFocus
            type="search"
            placeholder="Search titles, transcripts, notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search meetings"
          />
        </div>
      )}

      {rec.state !== "idle" && (
        <button className="live-banner" onClick={() => go("record")}>
          <i className="rec-dot" /> Recording in progress — tap to return
        </button>
      )}

      <button className="ask-entry" onClick={() => go("ask")}>
        <Sparkles />
        <span>
          <b>Ask about all your meetings</b>
          <small>“What did we decide about the launch?” · “What do I owe people this week?”</small>
        </span>
        <MessageCircle className="ask-entry-icon" />
      </button>

      {meetings.length > 0 && (
        <div className="filters" role="group" aria-label="Filter">
          {(
            [
              ["all", `All ${meetings.length}`],
              ["starred", "Starred"],
              ["tasks", `Open tasks${openTasks ? " " + openTasks : ""}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {groups.length ? (
        groups.map(([label, list]) => (
          <section key={label} className="day">
            <h2 className="day-label">{label}</h2>
            {list.map((m) => (
              <MeetingRow key={m.id} m={m} query={query} />
            ))}
          </section>
        ))
      ) : meetings.length ? (
        <p className="quiet-note">Nothing matches.</p>
      ) : (
        <Empty
          icon={<Mic />}
          title="Record your first meeting"
          body="Words show up while people talk. When you stop, you get a summary, an outline, and action items — and you can export all of it."
          action={
            <button className="btn btn-rec" onClick={() => go("record")}>
              <i className="rec-dot" /> Start recording
            </button>
          }
        />
      )}

      <button className="fab-record" onClick={() => go("record")} aria-label="Record">
        {rec.state !== "idle" ? <i className="rec-dot" /> : <Mic />}
      </button>
    </div>
  );
}

function MeetingRow({ m, query }: { m: Meeting; query: string }) {
  const stats = usePieceStats(m);
  const importing = useImportProgress(m.id);
  const status = statusText(m, stats, importing);
  const speakers = [...new Set(m.segments.map((s) => s.speaker))].slice(0, 4);
  const match = query.trim()
    ? m.segments.find((s) => s.text.toLowerCase().includes(query.trim().toLowerCase()))
    : undefined;
  const open = m.notes?.actions.filter((a) => !a.done).length || 0;
  const snippet = match ? `“…${excerpt(match.text, query)}…”` : m.notes?.summary || m.segments.slice(0, 2).map((s) => s.text).join(" ");
  return (
    <button className="row" onClick={() => go("m/" + m.id)}>
      <div className="row-top">
        <span className="row-title">
          {m.starred && <Star className="star-on" />}
          {m.title}
        </span>
        <span className="row-time mono">{timeOf(m.createdAt)}</span>
      </div>
      {m.peaks.length > 0 && <Waveform peaks={m.peaks} bars={72} height={22} className="row-wave" />}
      <div className="row-meta" style={m.peaks.length ? undefined : { marginTop: 8 }}>
        {m.duration > 0 && <span>{minutes(m.duration)}</span>}
        {speakers.length > 0 && <span>{speakers.map((s) => shortName(speakerName(m, s))).join(", ")}</span>}
        {open > 0 && <span className="tick">{open} open task{open === 1 ? "" : "s"}</span>}
        {status && <span className={`status status-${m.status}`}>{status}</span>}
      </div>
      {snippet && <p className="row-snippet">{snippet}</p>}
    </button>
  );
}

function excerpt(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
  return text.slice(Math.max(0, i - 50), i + 90).trim();
}

const shortName = (n: string) => (/^Speaker\b/i.test(n) ? n : n.split(" ")[0]);

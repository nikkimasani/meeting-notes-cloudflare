import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Mic,
  Square,
  Upload,
  Search,
  FileText,
  ListChecks,
  Clock,
  Trash2,
  Download,
  ShieldCheck,
  Play,
  Pause,
  Share2,
  Plus,
  Tag,
  Star,
  X,
  Archive,
  BarChart3,
  CalendarPlus,
  Copy,
  Folder,
  Mail,
  Printer,
  RotateCcw,
  Wifi,
  WifiOff,
  Settings,
  Cloud,
  Database,
  Smartphone,
  Sun,
  Moon,
  Monitor,
  Home,
  CalendarDays,
  CheckSquare2,
  Bell,
  ChevronLeft,
  ChevronRight,
  AudioLines,
  CircleAlert,
  Loader2,
  CheckCircle2,
  Clock3,
  Users,
  Sparkles,
  MoreHorizontal,
  MessageSquareText,
  ChevronDown,
  Info,
  Check,
} from "lucide-react";
import "@fontsource-variable/geist";
import "@fontsource/geist-mono/400.css";
import "@fontsource/instrument-serif/400.css";
import "./styles.css";
import { Upload as TusUpload } from "tus-js-client";
import {
  appendRecordingChunk,
  beginRecording,
  completeRecording,
  getRecording,
  listRecordings,
  setRecordingBackupStatus,
  type RecordingBackupStatus,
} from "./recording-store";

type TranscriptSegment = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};
type ActionItem = {
  task: string;
  owner?: string | null;
  due?: string | null;
  priority?: "low" | "medium" | "high";
};
type TranscriptionState =
  | "awaiting_sign_in"
  | "uploading"
  | "queued"
  | "processing"
  | "retrying"
  | "complete"
  | "partial"
  | "failed"
  | "canceled";
type Meeting = {
  id: string;
  updatedAt?: string;
  title: string;
  date: string;
  duration: number;
  transcript: string;
  transcriptSegments?: TranscriptSegment[];
  speakerNames?: Record<string, string>;
  customVocabulary?: string;
  summary: string;
  actions: string[];
  actionDetails?: ActionItem[];
  keyPoints?: string[];
  decisions?: string[];
  topics?: string[];
  followUp?: string[];
  openQuestions?: string[];
  risks?: string[];
  meetingType?: string;
  language?: string;
  tags?: string[];
  completed?: boolean[];
  favorite?: boolean;
  audio?: string;
  audioPath?: string;
  localRecordingId?: string;
  recordingBackupStatus?: RecordingBackupStatus;
  transcriptionJobId?: string;
  transcriptionState?: TranscriptionState;
  transcriptionProgress?: number;
  transcriptionCompletedParts?: number;
  transcriptionTotalParts?: number;
  transcriptionError?: string;
  attendees?: string;
  agenda?: string;
  folder?: string;
  status?: "planned" | "complete";
  archived?: boolean;
  notes?: string;
  followupEmail?: string;
};
type TranscriptionPartCheckpoint = {
  index: number;
  duration: number;
  transcript: string;
  segments: TranscriptSegment[];
};
type TranscriptionCheckpoint = {
  version: 2;
  partSeconds: number;
  totalParts: number;
  completed: TranscriptionPartCheckpoint[];
  updatedAt: string;
};
const seed: Meeting[] = [
  {
    id: "welcome",
    title: "Welcome to Said and Done",
    date: new Date().toISOString(),
    duration: 0,
    language: "auto",
    transcript:
      "Record a meeting or import an audio file. Your recordings and notes stay on this device.",
    summary:
      "A private workspace that turns conversations into clear summaries, decisions, and action items.",
    actions: ["Record your first meeting"],
  },
];
const storeKey = "meeting-notes-v1";
const load = (): Meeting[] => {
  try {
    const saved: Meeting[] =
      JSON.parse(localStorage.getItem(storeKey) || "null") || seed;
    return saved.map((meeting) =>
      meeting.id === "welcome" &&
      ["Welcome to SaidDone", "Welcome to Meeting Notes"].includes(
        meeting.title,
      )
        ? { ...meeting, title: "Welcome to Said and Done" }
        : meeting,
    );
  } catch {
    return seed;
  }
};
const summarize = (text: string) => {
  const clean = (text.match(/[^.!?\n]+[.!?]?/g) || [])
    .map((s) => s.replace(/^\s*(speaker\s*\d+|[A-Z][a-z]+):\s*/i, "").trim())
    .filter((s) => s.length > 2);
  if (!clean.length)
    return { summary: "No transcript is available yet.", actions: [] };
  const stop = new Set(
    "the a an and or but to of in on for with is are was were be been it this that we i you they he she our your their from at as by about so just really have has had do did can could would".split(
      " ",
    ),
  );
  const freq = new Map<string, number>();
  clean
    .join(" ")
    .toLowerCase()
    .match(/[a-z][a-z\x27-]{2,}/g)
    ?.forEach((w) => {
      if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
    });
  const topics = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);
  const actionPattern =
    /\b(?:i|we|you|they|he|she|[A-Z][a-z]+)\s+(?:will|need(?:s)? to|should|must|plan(?:s)? to|agreed to|is going to|are going to)\b|^(?:please\s+)?(?:send|review|complete|schedule|confirm|check|update|create|prepare|call|email|share|follow up|finish|submit|assign|contact)\b|\b(?:due|deadline|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|\w+ \d{1,2}))\b/i;
  const decisionPattern =
    /\b(decided|agreed|approved|selected|confirmed|finalized|will proceed|moving forward)\b/i;
  const actions = clean.filter((s) => actionPattern.test(s)).slice(0, 8);
  const decisions = clean.filter((s) => decisionPattern.test(s)).slice(0, 4);
  const scored = clean
    .map((s, i) => ({
      s,
      i,
      score:
        (s.toLowerCase().match(/[a-z][a-z\x27-]{2,}/g) || []).reduce(
          (n, w) => n + (freq.get(w) || 0),
          0,
        ) / Math.max(5, s.split(/\s+/).length),
    }))
    .filter((x) => !actions.includes(x.s))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  const parts = [
    `Overview: The meeting focused on ${topics.length ? topics.join(", ") : "the topics captured in the transcript"}.`,
    scored.length
      ? `Key points:\n${scored.map((s) => "• " + s).join("\n")}`
      : "",
    decisions.length
      ? `Decisions:\n${decisions.map((s) => "• " + s).join("\n")}`
      : "No explicit decisions were identified.",
    actions.length
      ? `Follow-up: ${actions.length} action item${actions.length === 1 ? "" : "s"} identified.`
      : "No explicit follow-up assignments were identified.",
  ];
  return { summary: parts.filter(Boolean).join("\n\n"), actions };
};
const fmt = (total: number) => {
  const s = Math.max(0, Math.floor(total || 0)),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
const humanDuration = (total: number) => {
  const minutes = Math.round((total || 0) / 60);
  if (!total) return "";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60 ? (minutes % 60) + " min" : ""}`.trim();
};
const isIsoDate = (value?: string | null) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
const formatDue = (value?: string | null) =>
  !value
    ? ""
    : isIsoDate(value)
      ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : value;
const isOverdue = (value?: string | null) =>
  isIsoDate(value) && new Date(value + "T23:59:59") < new Date();
// Placeholder text the app writes into a transcript before real speech exists.
const hasRealTranscript = (text?: string) => {
  const t = (text || "").trim();
  return (
    t.length > 0 &&
    !/^(processing audio…|recording recovered\.|transcription queued safely)/i.test(t) &&
    t !== seed[0].transcript
  );
};
type TranscriptionView = {
  tone: "neutral" | "busy" | "warn" | "ok";
  label: string;
  progress?: number;
};
const transcriptionView = (m: Meeting): TranscriptionView | null => {
  const st = m.transcriptionState;
  const progress = m.transcriptionTotalParts
    ? (m.transcriptionCompletedParts || 0) / m.transcriptionTotalParts
    : m.transcriptionProgress;
  if (st === "uploading") return { tone: "busy", label: "Uploading audio", progress };
  if (st === "queued") return { tone: "busy", label: "Queued for transcription", progress };
  if (st === "processing" || st === "retrying")
    return { tone: "busy", label: "Transcribing", progress };
  if (st === "partial") return { tone: "warn", label: "Transcription paused", progress };
  if (st === "failed" || st === "canceled")
    return { tone: "warn", label: "Transcription failed" };
  if (st === "awaiting_sign_in") return { tone: "warn", label: "Waiting to transcribe" };
  if (m.localRecordingId && !hasRealTranscript(m.transcript))
    return { tone: "warn", label: "Needs transcription" };
  return null;
};
const reminderMessage = (
  permission: NotificationPermission | "unsupported",
) =>
  permission === "granted"
    ? "Notifications are allowed on this device."
    : permission === "denied"
      ? "Notifications are blocked. Allow them in your browser settings."
      : permission === "unsupported"
        ? "This browser does not support notifications."
        : "Turn on to allow reminder notifications.";
const captionTime = (seconds: number, separator: "," | ".") => {
  const safe = Math.max(0, seconds || 0),
    hours = Math.floor(safe / 3600),
    minutes = Math.floor((safe % 3600) / 60),
    secs = Math.floor(safe % 60),
    millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(millis).padStart(3, "0")}`;
};
const localDateTime = (iso: string) => {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};
const safeName = (name: string) =>
  name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "meeting-notes";
const isIOSDevice = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandaloneApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  !!(navigator as any).standalone;
// Keep browser-generated WAV uploads below the 4.5 MB platform limit. A 110-second,
// 16 kHz mono PCM WAV is about 3.5 MB, leaving room for multipart headers.
const TRANSCRIPTION_PART_SECONDS = 110;
const BACKGROUND_TRANSCRIPTION_PART_SECONDS = 600;
const TRANSCRIPTION_CONCURRENCY = 3;
const transcriptionCheckpointKey = (meetingId: string) =>
  `said-done-transcription-v2:${meetingId}`;
const loadTranscriptionCheckpoint = (
  meetingId: string,
): TranscriptionCheckpoint | null => {
  try {
    const value = JSON.parse(
      localStorage.getItem(transcriptionCheckpointKey(meetingId)) || "null",
    );
    return value?.version === 2 && Array.isArray(value.completed) ? value : null;
  } catch {
    return null;
  }
};
const saveTranscriptionCheckpoint = (
  meetingId: string,
  checkpoint: TranscriptionCheckpoint,
) => {
  try {
    localStorage.setItem(
      transcriptionCheckpointKey(meetingId),
      JSON.stringify(checkpoint),
    );
  } catch (error) {
    console.warn("Could not save transcription checkpoint", error);
  }
};
const clearTranscriptionCheckpoint = (meetingId: string) => {
  localStorage.removeItem(transcriptionCheckpointKey(meetingId));
};
const TRANSCRIPTION_SAMPLE_RATE = 16000;
function makeDecoder() {
  // Decoding straight to 16 kHz keeps memory low on phones.
  let offline: OfflineAudioContext | null = null;
  try {
    offline = new OfflineAudioContext(1, 1, TRANSCRIPTION_SAMPLE_RATE);
  } catch {
    offline = null;
  }
  let fallback: AudioContext | null = null;
  return {
    async decode(data: ArrayBuffer): Promise<AudioBuffer> {
      if (offline) {
        try {
          return await offline.decodeAudioData(data.slice(0));
        } catch {
          /* try a regular context */
        }
      }
      fallback = fallback || new AudioContext();
      return await fallback.decodeAudioData(data);
    },
    close() {
      if (fallback) void fallback.close();
    },
  };
}
const boxType = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
// iOS records fragmented MP4 (one fragment per 5 s timeslice). Safari's
// decodeAudioData only reads the FIRST fragment, so a 38-minute meeting
// decodes as ~5 seconds. Split into init segment + fragments and decode each.
function splitFragmentedMp4(
  bytes: Uint8Array,
): Array<{ init: Uint8Array; start: number; end: number }> | null {
  if (bytes.length < 8 || boxType(bytes, 0) !== "ftyp") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fragments: Array<{ init: Uint8Array; start: number; end: number }> = [];
  let initStart = 0,
    init: Uint8Array | null = null,
    fragStart = -1,
    at = 0;
  const closeFragment = (end: number) => {
    if (fragStart >= 0 && init) fragments.push({ init, start: fragStart, end });
    fragStart = -1;
  };
  while (at + 8 <= bytes.length) {
    let size = view.getUint32(at);
    const type = boxType(bytes, at);
    if (size === 1 && at + 16 <= bytes.length)
      size = Number(view.getBigUint64(at + 8));
    else if (size === 0) size = bytes.length - at;
    if (size < 8) break;
    if (type === "ftyp") {
      closeFragment(at);
      initStart = at;
      init = null;
    } else if (type === "moof") {
      closeFragment(at);
      if (!init) init = bytes.subarray(initStart, at);
      fragStart = at;
    }
    at += size;
  }
  closeFragment(Math.min(at, bytes.length));
  return fragments.length > 1 ? fragments : null;
}
// Reset each fragment's start time (tfdt) to 0 so it decodes as a standalone
// 5-second clip instead of being padded with silence up to its offset.
function zeroFragmentStartTime(piece: Uint8Array, moofAt: number) {
  const view = new DataView(piece.buffer, piece.byteOffset, piece.byteLength);
  const walk = (start: number, end: number) => {
    let at = start;
    while (at + 8 <= end) {
      const size = view.getUint32(at),
        type = boxType(piece, at);
      if (size < 8 || at + size > end) return;
      if (type === "traf") walk(at + 8, at + size);
      else if (type === "tfdt") {
        if (piece[at + 8] === 1) view.setBigUint64(at + 12, 0n);
        else view.setUint32(at + 12, 0);
      }
      at += size;
    }
  };
  const moofSize = view.getUint32(moofAt);
  walk(moofAt + 8, moofAt + moofSize);
}
class WavPartWriter {
  parts: Blob[] = [];
  private buffer: Int16Array;
  private filled = 0;
  constructor(private samplesPerPart: number) {
    this.buffer = new Int16Array(samplesPerPart);
  }
  push(audio: AudioBuffer) {
    const rate = audio.sampleRate,
      channels = Array.from({ length: audio.numberOfChannels }, (_, c) =>
        audio.getChannelData(c),
      ),
      frames = Math.floor((audio.length * TRANSCRIPTION_SAMPLE_RATE) / rate);
    for (let i = 0; i < frames; i++) {
      const src = Math.min(
        audio.length - 1,
        Math.floor((i * rate) / TRANSCRIPTION_SAMPLE_RATE),
      );
      let sample = 0;
      for (let c = 0; c < channels.length; c++) sample += channels[c][src];
      sample = Math.max(-1, Math.min(1, sample / channels.length));
      this.buffer[this.filled++] = sample < 0 ? sample * 32768 : sample * 32767;
      if (this.filled === this.samplesPerPart) this.flush();
    }
  }
  flush() {
    if (!this.filled) return;
    const pcm = this.buffer.slice(0, this.filled),
      header = new ArrayBuffer(44),
      view = new DataView(header),
      write = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i++)
          view.setUint8(offset + i, value.charCodeAt(i));
      };
    write(0, "RIFF");
    view.setUint32(4, 36 + pcm.byteLength, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, TRANSCRIPTION_SAMPLE_RATE, true);
    view.setUint32(28, TRANSCRIPTION_SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, pcm.byteLength, true);
    this.parts.push(new Blob([header, pcm.buffer], { type: "audio/wav" }));
    this.filled = 0;
  }
}
async function createTranscriptionParts(
  blob: Blob,
  secondsPerPart = TRANSCRIPTION_PART_SECONDS,
  onProgress?: (fraction: number) => void,
): Promise<Blob[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    decoder = makeDecoder(),
    writer = new WavPartWriter(secondsPerPart * TRANSCRIPTION_SAMPLE_RATE);
  try {
    const fragments = splitFragmentedMp4(bytes);
    if (fragments) {
      let decodedCount = 0;
      for (let i = 0; i < fragments.length; i++) {
        const { init, start, end } = fragments[i],
          piece = new Uint8Array(init.length + (end - start));
        piece.set(init, 0);
        piece.set(bytes.subarray(start, end), init.length);
        zeroFragmentStartTime(piece, init.length);
        try {
          writer.push(await decoder.decode(piece.buffer));
          decodedCount++;
        } catch {
          /* skip a damaged fragment (e.g. the last one after a crash) */
        }
        if (i % 10 === 0) onProgress?.(i / fragments.length);
      }
      if (!decodedCount)
        throw new Error(
          "This recording could not be decoded on this device. Your audio is still saved.",
        );
    } else {
      try {
        writer.push(await decoder.decode(bytes.buffer));
      } catch {
        throw new Error(
          "This recording could not be decoded on this device. Your audio is still saved.",
        );
      }
    }
    writer.flush();
  } finally {
    decoder.close();
  }
  if (!writer.parts.length)
    throw new Error("No audio was found in this recording.");
  return writer.parts;
}
const SB_URL = "https://bazjlrualnmbanmhiuau.supabase.co";
const SB_KEY = "sb_publishable_ez3TVctnbFIUHqr_dMOUeQ_5WpsYEHs";
// Same-origin: on Cloudflare Pages, /api/* is proxied to the Vercel API by
// functions/api/[[path]].js, so errors arrive as readable responses instead of
// Safari's opaque "Load failed" cross-origin network error.
const API_BASE = "";
type Session = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string };
};
const sessionKey = "meeting-notes-session";
const loadSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    return null;
  }
};

type Theme = "system" | "light" | "dark";
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  };
  React.useLayoutEffect(resize, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        resize();
      }
    });
    observer.observe(el);
    void document.fonts?.ready.then(resize);
    return () => observer.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`auto-textarea ${className || ""}`}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
type MobileTab = "conversations" | "calendar" | "actions";
type MobileHomeProps = {
  meetings: Meeting[];
  query: string;
  tab: MobileTab;
  onQuery: (value: string) => void;
  onTab: (tab: MobileTab) => void;
  onOpenMeeting: (id: string) => void;
  onRecord: () => void;
  onSchedule: () => void;
  onSettings: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleAction: (meetingId: string, index: number) => void;
  signedIn: boolean;
};
const dateHeading = (iso: string) => {
  const date = new Date(iso),
    today = new Date(),
    yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Today";
  if (same(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
};
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function StatusBadge({ view }: { view: TranscriptionView | null }) {
  if (!view) return null;
  return (
    <span className={`badge badge-${view.tone}`}>
      {view.tone === "busy" ? <Loader2 className="spin" /> : <CircleAlert />}
      {view.label}
      {view.tone === "busy" && view.progress ? ` · ${Math.round(view.progress * 100)}%` : ""}
    </span>
  );
}
function ConversationCard({
  meeting,
  onOpen,
}: {
  meeting: Meeting;
  onOpen: () => void;
}) {
  const view = transcriptionView(meeting);
  const open = meeting.actions.filter((_, i) => !meeting.completed?.[i]).length;
  const summary = hasRealTranscript(meeting.transcript) || !meeting.localRecordingId
    ? meeting.summary
    : "";
  return (
    <button className="conversation-card" onClick={onOpen}>
      <span className="conversation-time">
        <b>{timeLabel(meeting.date)}</b>
        {meeting.duration ? <small>{humanDuration(meeting.duration)}</small> : null}
      </span>
      <span className="conversation-body">
        <span className="conversation-title">
          {meeting.favorite && <Star className="fav" />}
          <b>{meeting.title}</b>
        </span>
        {summary && <p>{summary.replace(/\s+/g, " ").slice(0, 180)}</p>}
        {(view || open > 0 || (meeting.tags?.length || 0) > 0) && (
          <span className="conversation-meta">
            <StatusBadge view={view} />
            {open > 0 && (
              <span className="badge">
                <ListChecks /> {open} open
              </span>
            )}
            {meeting.tags?.slice(0, 2).map((tag) => (
              <span className="badge badge-tag" key={tag}>
                #{tag}
              </span>
            ))}
          </span>
        )}
      </span>
      <ChevronRight className="chev" />
    </button>
  );
}
function MobileHome({
  meetings,
  query,
  tab,
  onQuery,
  onTab,
  onOpenMeeting,
  onRecord,
  onSchedule,
  onSettings,
  onImport,
  onToggleAction,
  signedIn,
}: MobileHomeProps) {
  const [actionFilter, setActionFilter] = useState<"all" | "overdue" | "high">(
    "all",
  );
  const active = meetings.filter((m) => !m.archived && m.id !== "welcome");
  const visible = active
    .filter((m) => m.status !== "planned")
    .filter((m) =>
      (m.title + " " + m.summary + " " + m.transcript + " " + (m.tags || []).join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const groups = visible.reduce<Record<string, Meeting[]>>((all, meeting) => {
    const key = dateHeading(meeting.date);
    (all[key] ||= []).push(meeting);
    return all;
  }, {});
  const actions = active
    .flatMap((meeting) =>
      meeting.actions.map((task, index) => ({
        meeting,
        task,
        index,
        detail: meeting.actionDetails?.[index],
        overdue: isOverdue(meeting.actionDetails?.[index]?.due),
        done: !!meeting.completed?.[index],
      })),
    )
    .filter((item) => !item.done);
  const overdueCount = actions.filter((item) => item.overdue).length;
  const highCount = actions.filter(
    (item) => item.detail?.priority === "high",
  ).length;
  const visibleActions = actions.filter(
    (item) =>
      actionFilter === "all" ||
      (actionFilter === "overdue" && item.overdue) ||
      (actionFilter === "high" && item.detail?.priority === "high"),
  );
  const now = Date.now();
  const agenda = active
    .filter((m) => m.status === "planned")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const upcoming = agenda.filter((m) => +new Date(m.date) >= now - 3600_000);
  const past = agenda.filter((m) => +new Date(m.date) < now - 3600_000);
  const nextUp = upcoming[0];
  const titles: Record<MobileTab, string> = {
    conversations: "Conversations",
    calendar: "Agenda",
    actions: "Action items",
  };
  return (
    <section className="mobile-home">
      <header className="home-top">
        <div className="wordmark" aria-label="Said and Done">
          <img src="/saiddone-mark.png" alt="" />
          <span>Said and Done</span>
        </div>
        <div className="home-actions">
          <label className="icon-button" aria-label="Import audio" title="Import audio">
            <Upload />
            <input type="file" accept="audio/*,video/*" onChange={onImport} />
          </label>
          <button className="icon-button" aria-label="Schedule a meeting" onClick={onSchedule}>
            <CalendarPlus />
          </button>
          <button
            className="avatar-button"
            aria-label="Open settings"
            onClick={onSettings}
          >
            <Settings />
            {signedIn && <i className="dot" />}
          </button>
        </div>
      </header>
      <h1 className="home-title">{titles[tab]}</h1>
      {tab === "conversations" ? (
        <div className="home-content">
          <div className="search-field">
            <Search />
            <input
              id="mobile-search"
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => onQuery("")}>
                <X />
              </button>
            )}
          </div>
          {nextUp && !query && (
            <button className="next-up" onClick={() => onOpenMeeting(nextUp.id)}>
              <span className="next-up-date">
                <small>
                  {new Date(nextUp.date).toLocaleDateString(undefined, { month: "short" })}
                </small>
                <b>{new Date(nextUp.date).getDate()}</b>
              </span>
              <span>
                <small>Up next · {timeLabel(nextUp.date)}</small>
                <b>{nextUp.title}</b>
              </span>
              <ChevronRight />
            </button>
          )}
          {Object.keys(groups).length ? (
            Object.entries(groups).map(([label, items]) => (
              <section className="conversation-group" key={label}>
                <h2>{label}</h2>
                <div className="card-stack">
                  {items.map((meeting) => (
                    <ConversationCard
                      key={meeting.id}
                      meeting={meeting}
                      onOpen={() => onOpenMeeting(meeting.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : query ? (
            <p className="empty-inline">No conversations match “{query}”.</p>
          ) : (
            <div className="home-empty">
              <span className="empty-icon">
                <AudioLines />
              </span>
              <h2>Your conversations live here</h2>
              <p>Record or import a meeting and you’ll get a transcript, summary, and action items.</p>
              <button className="btn btn-record" onClick={onRecord}>
                <Mic /> Start recording
              </button>
            </div>
          )}
        </div>
      ) : tab === "calendar" ? (
        <div className="home-content">
          <button className="btn btn-secondary btn-block" onClick={onSchedule}>
            <Plus /> Schedule a meeting
          </button>
          {agenda.length ? (
            <>
              {upcoming.length > 0 && (
                <section className="conversation-group">
                  <h2>Upcoming</h2>
                  <div className="card-stack">
                    {upcoming.map((meeting) => (
                      <button
                        className="agenda-card"
                        key={meeting.id}
                        onClick={() => onOpenMeeting(meeting.id)}
                      >
                        <span className="next-up-date">
                          <small>
                            {new Date(meeting.date).toLocaleDateString(undefined, { month: "short" })}
                          </small>
                          <b>{new Date(meeting.date).getDate()}</b>
                        </span>
                        <span className="conversation-body">
                          <b>{meeting.title}</b>
                          <small>
                            {new Date(meeting.date).toLocaleDateString(undefined, { weekday: "long" })} · {timeLabel(meeting.date)}
                            {meeting.attendees ? ` · ${meeting.attendees}` : ""}
                          </small>
                        </span>
                        <ChevronRight className="chev" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section className="conversation-group">
                  <h2>Past, not recorded</h2>
                  <div className="card-stack">
                    {past.map((meeting) => (
                      <button
                        className="agenda-card muted"
                        key={meeting.id}
                        onClick={() => onOpenMeeting(meeting.id)}
                      >
                        <span className="next-up-date">
                          <small>
                            {new Date(meeting.date).toLocaleDateString(undefined, { month: "short" })}
                          </small>
                          <b>{new Date(meeting.date).getDate()}</b>
                        </span>
                        <span className="conversation-body">
                          <b>{meeting.title}</b>
                          <small>{timeLabel(meeting.date)}</small>
                        </span>
                        <ChevronRight className="chev" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="home-empty">
              <span className="empty-icon">
                <CalendarDays />
              </span>
              <h2>Your agenda is clear</h2>
              <p>Schedule a meeting to prepare an agenda and record it when it starts.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="home-content">
          {actions.length ? (
            <>
              <div className="segmented" role="group" aria-label="Filter action items">
                {(
                  [
                    ["all", `All · ${actions.length}`],
                    ["overdue", `Overdue · ${overdueCount}`],
                    ["high", `High · ${highCount}`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    className={actionFilter === key ? "active" : ""}
                    onClick={() => setActionFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="card-stack">
                {visibleActions.map(({ meeting, task, index, detail, overdue }) => (
                  <div className="task-card" key={meeting.id + index}>
                    <button
                      className="task-check"
                      aria-label={"Mark done: " + task}
                      onClick={() => onToggleAction(meeting.id, index)}
                    />
                    <button className="task-body" onClick={() => onOpenMeeting(meeting.id)}>
                      <b>{task}</b>
                      <span className="conversation-meta">
                        {detail?.priority === "high" && (
                          <span className="badge badge-warn">High</span>
                        )}
                        {detail?.due && (
                          <span className={overdue ? "badge badge-danger" : "badge"}>
                            <Clock3 /> {overdue ? "Overdue · " : ""}
                            {formatDue(detail.due)}
                          </span>
                        )}
                        {detail?.owner && (
                          <span className="badge">
                            <Users /> {detail.owner}
                          </span>
                        )}
                      </span>
                      <small>{meeting.title}</small>
                    </button>
                  </div>
                ))}
                {visibleActions.length === 0 && (
                  <p className="empty-inline">No open items match this filter.</p>
                )}
              </div>
            </>
          ) : (
            <div className="home-empty">
              <span className="empty-icon">
                <CheckCircle2 />
              </span>
              <h2>All caught up</h2>
              <p>Action items from your meeting summaries will appear here.</p>
            </div>
          )}
        </div>
      )}
      <nav className="app-nav" aria-label="Main navigation">
        <button
          className={tab === "conversations" ? "active" : ""}
          aria-current={tab === "conversations" ? "page" : undefined}
          onClick={() => onTab("conversations")}
        >
          <Home />
          <span>Home</span>
        </button>
        <button
          className={tab === "calendar" ? "active" : ""}
          aria-current={tab === "calendar" ? "page" : undefined}
          onClick={() => onTab("calendar")}
        >
          <CalendarDays />
          <span>Agenda</span>
        </button>
        <button
          className="record-orb"
          onClick={onRecord}
          aria-label="Record a meeting"
        >
          <Mic />
        </button>
        <button
          className={tab === "actions" ? "active" : ""}
          aria-current={tab === "actions" ? "page" : undefined}
          onClick={() => onTab("actions")}
        >
          <CheckSquare2 />
          <span>Tasks</span>
          {actions.length > 0 && <i className="nav-count">{actions.length}</i>}
        </button>
        <button onClick={onSettings}>
          <Settings />
          <span>Settings</span>
        </button>
      </nav>
    </section>
  );
}
type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  session: Session | null;
  email: string;
  password: string;
  authMode: "signin" | "signup";
  cloudStatus: string;
  online: boolean;
  installAvailable: boolean;
  theme: Theme;
  autoSync: boolean;
  remindersEnabled: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onAuthMode: () => void;
  onAuthenticate: () => void;
  onSync: () => void;
  onSignOut: () => void;
  onBackup: () => void;
  onRestore: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onInstall: () => void;
  onTheme: (theme: Theme) => void;
  onAutoSync: (enabled: boolean) => void;
  onRemindersEnabled: (enabled: boolean) => void;
  onEnableReminders: () => void;
  meetingReminderMinutes: number;
  taskReminderTime: string;
  onMeetingReminderMinutes: (minutes: number) => void;
  onTaskReminderTime: (time: string) => void;
  calendarConnections: Record<string, string>;
  calendarStatus: string;
  calendarBusy: boolean;
  onConnectCalendar: (provider: string) => void;
  onDisconnectCalendar: (provider: string) => void;
  onSyncCalendars: () => void;
  calendarHistory: any[];
};
function SettingsPanel({
  open,
  onClose,
  session,
  email,
  password,
  authMode,
  cloudStatus,
  online,
  installAvailable,
  theme,
  autoSync,
  remindersEnabled,
  notificationPermission,
  onEmail,
  onPassword,
  onAuthMode,
  onAuthenticate,
  onSync,
  onSignOut,
  onBackup,
  onRestore,
  onInstall,
  onTheme,
  onAutoSync,
  onRemindersEnabled,
  onEnableReminders,
  meetingReminderMinutes,
  taskReminderTime,
  onMeetingReminderMinutes,
  onTaskReminderTime,
  calendarConnections,
  calendarStatus,
  calendarBusy,
  onConnectCalendar,
  onDisconnectCalendar,
  onSyncCalendars,
  calendarHistory,
}: SettingsPanelProps) {
  const panel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    document.body.classList.add("settings-visible");
    return () => {
      document.removeEventListener("keydown", key);
      document.body.classList.remove("settings-visible");
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="settings-layer">
      <button
        className="settings-backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        className="settings-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <div className="settings-header">
          <div>
            <span className="eyebrow">Your workspace</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X />
          </button>
        </div>
        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-heading">
              <Cloud />
              <div>
                <h3>Account and cloud sync</h3>
                <p>Keep your meeting library available across your devices.</p>
              </div>
            </div>
            {session ? (
              <div className="account-card">
                <div className="account-avatar">
                  {session.user.email?.slice(0, 1).toUpperCase() || "M"}
                </div>
                <div>
                  <b>{session.user.email}</b>
                  <small>Protected cloud account</small>
                </div>
                <span className="status-pill">Connected</span>
              </div>
            ) : (
              <div className="auth-form">
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => onEmail(e.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete={
                      authMode === "signup"
                        ? "new-password"
                        : "current-password"
                    }
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => onPassword(e.target.value)}
                  />
                </label>
              </div>
            )}
            <div className="settings-actions">
              {session ? (
                <>
                  <button className="primary-action" onClick={onSync}>
                    Sync now
                  </button>
                  <button className="secondary-action" onClick={onSignOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary-action"
                    onClick={onAuthenticate}
                    disabled={!email || password.length < 8}
                  >
                    {authMode === "signup" ? "Create account" : "Sign in"}
                  </button>
                  <button className="secondary-action" onClick={onAuthMode}>
                    {authMode === "signin"
                      ? "Create an account"
                      : "I already have an account"}
                  </button>
                </>
              )}
            </div>
            {cloudStatus && <p className="inline-status">{cloudStatus}</p>}
            <label className="setting-row">
              <span>
                <b>Automatic sync</b>
                <small>Sync after your meeting library changes.</small>
              </span>
              <input
                className="switch"
                type="checkbox"
                checked={autoSync}
                onChange={(e) => onAutoSync(e.target.checked)}
              />
            </label>
          </section>
          <section className="settings-section">
            <div className="settings-section-heading">
              <CalendarDays />
              <div>
                <h3>Calendar connections</h3>
                <p>
                  Sync planned meetings both ways with Google Calendar and
                  Outlook.
                </p>
              </div>
            </div>
            {!session && (
              <p className="inline-status">Sign in above to connect a calendar.</p>
            )}
            {session && (<>
            <p className="inline-status">
              Only meetings in your Said and Done agenda are linked. Unrelated
              calendar events stay out of your library; deletions are reported
              without removing events.
            </p>
            <div className="settings-actions">
              {(["google", "microsoft"] as const).map((provider) => (
                <button
                  key={provider}
                  className={
                    calendarConnections[provider]
                      ? "secondary-action"
                      : "primary-action"
                  }
                  disabled={!session || calendarBusy}
                  onClick={() =>
                    calendarConnections[provider]
                      ? onDisconnectCalendar(provider)
                      : onConnectCalendar(provider)
                  }
                >
                  {calendarConnections[provider]
                    ? "Disconnect " +
                      (provider === "google" ? "Google Calendar" : "Outlook") +
                      " (" +
                      calendarConnections[provider] +
                      ")"
                    : "Connect " +
                      (provider === "google" ? "Google Calendar" : "Outlook")}
                </button>
              ))}
              <button
                className="secondary-action"
                disabled={
                  !session ||
                  calendarBusy ||
                  !Object.keys(calendarConnections).length
                }
                onClick={onSyncCalendars}
              >
                {calendarBusy ? "Syncing…" : "Sync both calendars"}
              </button>
            </div>
            </>)}
            {calendarStatus && (
              <p className="inline-status" role="status">
                {calendarStatus}
              </p>
            )}
            {calendarHistory.length > 0 && (
              <div className="calendar-history">
                <b>Recent syncs</b>
                {calendarHistory.slice(0, 5).map((run, i) => (
                  <p key={i} className="inline-status">
                    {new Date(run.at).toLocaleString()} ·{" "}
                    {(run.results || [])
                      .map(
                        (r: any) =>
                          r.provider + (r.error ? ": " + r.error : ""),
                      )
                      .join(" · ")}
                  </p>
                ))}
              </div>
            )}
          </section>
          <section className="settings-section">
            <div className="settings-section-heading">
              <Monitor />
              <div>
                <h3>Appearance</h3>
                <p>Choose how Said and Done looks on this device.</p>
              </div>
            </div>
            <div
              className="theme-picker"
              role="radiogroup"
              aria-label="Color theme"
            >
              {(
                [
                  ["system", Monitor, "System"],
                  ["light", Sun, "Light"],
                  ["dark", Moon, "Dark"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  className={theme === value ? "active" : ""}
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => onTheme(value)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section-heading">
              <Bell />
              <div>
                <h3>Task and meeting reminders</h3>
                <p>
                  Get local reminders for upcoming meetings and action items.
                </p>
              </div>
            </div>
            <label className="setting-row">
              <span>
                <b>Browser notifications</b>
                <small>{reminderMessage(notificationPermission)}</small>
              </span>
              <input
                className="switch"
                type="checkbox"
                checked={
                  remindersEnabled && notificationPermission === "granted"
                }
                disabled={
                  notificationPermission === "denied" ||
                  notificationPermission === "unsupported"
                }
                onChange={(e) =>
                  e.target.checked
                    ? onEnableReminders()
                    : onRemindersEnabled(false)
                }
              />
            </label>
            <label className="setting-row">
              <span>
                <b>Meeting reminder lead time</b>
                <small>Choose how early a meeting alert arrives.</small>
              </span>
              <select
                aria-label="Meeting reminder lead time"
                value={meetingReminderMinutes}
                onChange={(e) =>
                  onMeetingReminderMinutes(Number(e.target.value))
                }
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </label>
            <label className="setting-row">
              <span>
                <b>Daily task reminder time</b>
                <small>Local time on the task due date.</small>
              </span>
              <input
                aria-label="Daily task reminder time"
                type="time"
                value={taskReminderTime}
                onChange={(e) => onTaskReminderTime(e.target.value)}
              />
            </label>
          </section>
          <section className="settings-section">
            <div className="settings-section-heading">
              <Database />
              <div>
                <h3>Data and storage</h3>
                <p>Your recordings and notes stay under your control.</p>
              </div>
            </div>
            <div className="settings-list">
              <button onClick={onBackup}>
                <span>
                  <Download />
                  <span>
                    <b>Back up all meetings</b>
                    <small>Download a portable JSON archive.</small>
                  </span>
                </span>
                <span>Download</span>
              </button>
              <label>
                <span>
                  <Upload />
                  <span>
                    <b>Restore a backup</b>
                    <small>Merge meetings from a saved archive.</small>
                  </span>
                </span>
                <span>Choose file</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={onRestore}
                />
              </label>
              {installAvailable && (
                <button onClick={onInstall}>
                  <span>
                    <Smartphone />
                    <span>
                      <b>Install Said and Done</b>
                      <small>Add the app to your home screen.</small>
                    </span>
                  </span>
                  <span>Install</span>
                </button>
              )}
            </div>
          </section>
          <section className="settings-section compact">
            <div className="settings-section-heading">
              <ShieldCheck />
              <div>
                <h3>Privacy and connection</h3>
                <p>
                  {session
                    ? "Cloud sync is protected by your account."
                    : "Meetings are currently stored only on this device."}
                </p>
              </div>
              <span className={online ? "connection online" : "connection"}>
                {online ? <Wifi /> : <WifiOff />}
                {online ? "Online" : "Offline"}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [meetings, setMeetings] = useState<Meeting[]>(load);
  const [selected, setSelected] = useState(meetings[0]?.id || "");
  const [session, setSession] = useState<Session | null>(loadSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [cloudStatus, setCloudStatus] = useState("");
  const [calendarConnections, setCalendarConnections] = useState<
    Record<string, string>
  >({});
  const [calendarStatus, setCalendarStatus] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarHistory, setCalendarHistory] = useState<any[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("said-done-calendar-history") || "[]",
      );
    } catch {
      return [];
    }
  });
  const calendarHistoryRef = useRef(calendarHistory);
  calendarHistoryRef.current = calendarHistory;
  const calendarCallbackHandled = useRef(false);
  const calendarMeetingsRef = useRef(meetings);
  calendarMeetingsRef.current = meetings;
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [folderFilter, setFolderFilter] = useState("all");
  const [showDashboard, setShowDashboard] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"home" | "detail" | "record">(
    "home",
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("conversations");
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("meeting-notes-theme") as Theme) || "system",
  );
  const [autoSync, setAutoSync] = useState(
    () => localStorage.getItem("meeting-notes-auto-sync") === "true",
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    () => localStorage.getItem("said-done-reminders") === "true",
  );
  const [meetingReminderMinutes, setMeetingReminderMinutes] = useState(
    () =>
      Number(localStorage.getItem("said-done-meeting-reminder-minutes")) || 15,
  );
  const [taskReminderTime, setTaskReminderTime] = useState(
    () => localStorage.getItem("said-done-task-reminder-time") || "09:00",
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const media = useRef<MediaRecorder | null>(null);
  const recognition = useRef<any>(null);
  const wakeLock = useRef<any>(null);
  const timer = useRef<number | undefined>(undefined);
  const recordingId = useRef<string | null>(null);
  const recordingStartedAt = useRef(0);
  const chunkSequence = useRef(0);
  const chunkWrites = useRef<Promise<void>>(Promise.resolve());
  const audioLoading = useRef(new Set<string>());
  const jobPolling = useRef(new Set<string>());
  const localTranscriptionRunning = useRef(new Set<string>());
  const autoResumeAttempted = useRef(new Set<string>());
  const autoBackgroundQueueAttempted = useRef(new Set<string>());
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const pausedAt = useRef(0);
  const pausedTotal = useRef(0);
  const recordingTarget = useRef<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  function notify(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }
  // Supabase access tokens expire after an hour; refresh before they do so
  // sync, cloud backup and background transcription keep working.
  useEffect(() => {
    if (!session?.refresh_token) return;
    const expiresAt = (() => {
      try {
        const payload = JSON.parse(
          atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        return Number(payload.exp) * 1000;
      } catch {
        return 0;
      }
    })();
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(
          SB_URL + "/auth/v1/token?grant_type=refresh_token",
          {
            method: "POST",
            headers: { apikey: SB_KEY, "content-type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          },
        );
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && data?.access_token) setSession(data);
        else if (response.status === 400 || response.status === 401) {
          setSession(null);
          setCloudStatus("Your sign-in expired. Sign in again to keep syncing.");
        }
      } catch {
        /* offline: try again later */
      }
    };
    const wait = Math.max(0, expiresAt - Date.now() - 5 * 60 * 1000);
    const id = window.setTimeout(() => void refresh(), wait);
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        expiresAt - Date.now() < 5 * 60 * 1000
      )
        void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session?.access_token]);
  function showReminderFallback(
    title: string,
    body: string,
    key: string,
    meetingId: string,
  ) {
    const notification = new Notification(title, {
      body,
      tag: key,
      data: { meetingId },
    });
    notification.onclick = () => {
      window.focus();
      window.location.assign("/?openMeeting=" + encodeURIComponent(meetingId));
    };
  }
  function sendReminder(
    key: string,
    title: string,
    body: string,
    meetingId: string,
  ) {
    let sent: string[] = [];
    try {
      sent = JSON.parse(
        localStorage.getItem("said-done-reminders-sent") || "[]",
      );
    } catch {}
    if (sent.includes(key)) return;
    sent.push(key);
    localStorage.setItem(
      "said-done-reminders-sent",
      JSON.stringify(sent.slice(-300)),
    );
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((reg) =>
          reg.showNotification(title, {
            body,
            tag: key,
            icon: "/saiddone-icon-192.png",
            data: { meetingId },
          }),
        )
        .catch(() => {
          if (Notification.permission === "granted")
            showReminderFallback(title, body, key, meetingId);
        });
    } else new Notification(title, { body, tag: key });
  }
  function enableReminders() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    void Notification.requestPermission().then((permission) => {
      setNotificationPermission(permission);
      if (permission === "granted") {
        localStorage.setItem("said-done-reminders", "true");
        setRemindersEnabled(true);
      }
    });
  }
  function saveReminderPreference(enabled: boolean) {
    localStorage.setItem("said-done-reminders", String(enabled));
    setRemindersEnabled(enabled);
  }
  function saveMeetingReminderMinutes(minutes: number) {
    localStorage.setItem("said-done-meeting-reminder-minutes", String(minutes));
    setMeetingReminderMinutes(minutes);
  }
  function saveTaskReminderTime(time: string) {
    localStorage.setItem("said-done-task-reminder-time", time);
    setTaskReminderTime(time);
  }
  useEffect(() => {
    if (!remindersEnabled || notificationPermission !== "granted") return;
    const check = () => {
      const now = Date.now();
      for (const meeting of meetings) {
        if (meeting.status === "planned") {
          const start = new Date(meeting.date).getTime();
          if (
            Number.isFinite(start) &&
            start > now &&
            start - meetingReminderMinutes * 60 * 1000 <= now
          )
            sendReminder(
              "meeting:" + meeting.id + ":" + meeting.date,
              "Meeting soon",
              meeting.title +
                " starts at " +
                new Date(meeting.date).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              meeting.id,
            );
        }
        for (let i = 0; i < meeting.actions.length; i++) {
          if (meeting.completed?.[i]) continue;
          const due = meeting.actionDetails?.[i]?.due;
          if (!due) continue;
          const dueAt = new Date(
            due + "T" + taskReminderTime + ":00",
          ).getTime();
          if (Number.isFinite(dueAt) && dueAt <= now)
            sendReminder(
              "action:" + meeting.id + ":" + i + ":" + due,
              "Action item due",
              meeting.actions[i] + " · " + meeting.title,
              meeting.id,
            );
        }
      }
    };
    check();
    const interval = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, [
    meetings,
    remindersEnabled,
    notificationPermission,
    meetingReminderMinutes,
    taskReminderTime,
  ]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action"),
      focus = params.get("focus");
    if (!action && !focus) return;
    if (action === "new") startMobileMeeting();
    if (focus === "search")
      window.setTimeout(
        () =>
          (document.getElementById("mobile-search") ||
            document.querySelector<HTMLInputElement>(".sidebar input[type=search]"))?.focus(),
        300,
      );
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("openMeeting");
    if (!id) return;
    const meeting = meetings.find((item) => item.id === id);
    if (!meeting) return;
    setSelected(meeting.id);
    setShowDashboard(false);
    setMobileView("detail");
    window.history.replaceState(
      {},
      "",
      window.location.pathname + window.location.hash,
    );
  }, [meetings]);
  useEffect(() => {
    try {
      localStorage.setItem(
        storeKey,
        JSON.stringify(
          meetings.map(({ audio, ...rest }) =>
            audio && !audio.startsWith("blob:") ? { ...rest, audio } : rest,
          ),
        ),
      );
    } catch (e) {
      console.warn("Could not save meetings", e);
    }
  }, [meetings]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js");
  }, []);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false),
      install = (event: any) => {
        event.preventDefault();
        setInstallPrompt(event);
      };
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    session
      ? localStorage.setItem(sessionKey, JSON.stringify(session))
      : localStorage.removeItem(sessionKey);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const pending = meetings.filter(
      (meeting) =>
        meeting.transcriptionJobId &&
        !["complete", "failed", "partial", "canceled"].includes(
          meeting.transcriptionState || "",
        ),
    );
    if (!pending.length) return;
    const poll = () =>
      pending.forEach((meeting) => void pollTranscriptionJob(meeting));
    poll();
    const interval = window.setInterval(poll, 12000);
    return () => window.clearInterval(interval);
  }, [
    session,
    meetings
      .map(
        (meeting) =>
          `${meeting.transcriptionJobId || ""}:${meeting.transcriptionState || ""}`,
      )
      .join("|"),
  ]);
  useEffect(() => {
    localStorage.setItem("meeting-notes-theme", theme);
    document.documentElement.dataset.theme = theme;
    if (theme === "system")
      delete document.documentElement.dataset.resolvedTheme;
    else document.documentElement.dataset.resolvedTheme = theme;
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("meeting-notes-auto-sync", String(autoSync));
  }, [autoSync]);
  useEffect(() => {
    if (!autoSync || !session) return;
    const id = window.setTimeout(() => void syncCloud(), 1800);
    return () => window.clearTimeout(id);
  }, [meetings, autoSync, session]);
  useEffect(() => {
    void listRecordings()
      .then((stored) => {
        if (!stored.length) return;
        const known = new Map(
          meetings.map((m) => [m.localRecordingId || m.id, m]),
        );
        const recovered: Meeting[] = [];
        for (const item of stored) {
          const existing = known.get(item.id);
          if (existing) {
            recovered.push({
              ...existing,
              transcript:
                existing.transcript === "Processing audio…" &&
                !["processing", "retrying"].includes(
                  existing.transcriptionState || "",
                )
                  ? "Recording recovered. Use “Transcribe recording” below when you are ready to retry."
                  : existing.transcript,
              audio: URL.createObjectURL(item.blob),
              audioPath: existing.audioPath || item.remotePath,
              localRecordingId: item.id,
              recordingBackupStatus: item.backupStatus,
            });
            continue;
          }
          const duration =
            item.duration ||
            Math.max(
              1,
              Math.round(
                (new Date(item.updatedAt).getTime() -
                  new Date(item.startedAt).getTime()) /
                  1000,
              ),
            );
          recovered.push({
            id: item.id,
            title: `Recovered meeting ${new Date(item.startedAt).toLocaleDateString()}`,
            date: item.startedAt,
            duration,
            language: "auto",
            status: "complete",
            transcript:
              "Recording recovered. Use “Transcribe recording” below when you are ready to retry.",
            summary:
              "Recovered from continuous local checkpoints after the app closed or refreshed.",
            actions: [],
            audio: URL.createObjectURL(item.blob),
            audioPath: item.remotePath,
            localRecordingId: item.id,
            recordingBackupStatus: item.backupStatus,
          });
        }
        setMeetings((currentMeetings) => {
          const byId = new Map(currentMeetings.map((m) => [m.id, m]));
          recovered.forEach((m) => byId.set(m.id, m));
          return [...byId.values()];
        });
        const newest = recovered[0];
        if (newest) {
          setSelected(newest.id);
          setCloudStatus(
            "Recovered a recording from its latest saved checkpoint.",
          );
        }
      })
      .catch(() =>
        setError("Local recording recovery is unavailable in this browser."),
      );
  }, []);
  useEffect(() => {
    const pending = meetings
      .filter(
        (meeting) =>
          meeting.localRecordingId &&
          !meeting.transcriptionJobId &&
          ["processing", "retrying", "partial"].includes(
            meeting.transcriptionState || "",
          ) &&
          !autoResumeAttempted.current.has(meeting.id),
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
    if (!pending?.localRecordingId) return;
    autoResumeAttempted.current.add(pending.id);
    void getRecording(pending.localRecordingId)
      .then((stored) => {
        if (!stored?.blob.size)
          throw new Error("The saved recording could not be found.");
        return processAudio(stored.blob, pending, true);
      })
      .catch((exception) =>
        setMeetings((items) =>
          items.map((item) =>
            item.id === pending.id
              ? {
                  ...item,
                  transcriptionState: "partial",
                  transcriptionError:
                    exception instanceof Error
                      ? exception.message
                      : "The interrupted transcription could not resume.",
                }
              : item,
          ),
        ),
      );
  }, [
    meetings
      .map(
        (meeting) =>
          `${meeting.id}:${meeting.transcriptionState || ""}:${meeting.localRecordingId || ""}`,
      )
      .join("|"),
  ]);
  useEffect(() => {
    if (!session) return;
    const pending = meetings
      .filter(
        (meeting) =>
          meeting.localRecordingId &&
          !meeting.transcriptionJobId &&
          meeting.transcriptionState === "awaiting_sign_in" &&
          !autoBackgroundQueueAttempted.current.has(meeting.id),
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
    if (!pending?.localRecordingId) return;
    autoBackgroundQueueAttempted.current.add(pending.id);
    void getRecording(pending.localRecordingId)
      .then((stored) => {
        if (!stored?.blob.size)
          throw new Error("The saved recording could not be found.");
        return queueBackgroundTranscription(stored.blob, pending, true);
      })
      .then((queued) => {
        if (queued) setSettingsOpen(false);
      })
      .catch((exception) =>
        setMeetings((items) =>
          items.map((item) =>
            item.id === pending.id
              ? {
                  ...item,
                  transcriptionState: "failed",
                  transcriptionError:
                    exception instanceof Error
                      ? exception.message
                      : "Background transcription could not start.",
                }
              : item,
          ),
        ),
      );
  }, [
    session,
    meetings
      .map(
        (meeting) =>
          `${meeting.id}:${meeting.transcriptionState || ""}:${meeting.transcriptionJobId || ""}`,
      )
      .join("|"),
  ]);
  useEffect(() => {
    if (!recording) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const visible = async () => {
      if (document.visibilityState === "visible" && !wakeLock.current) {
        try {
          wakeLock.current = await (navigator as any).wakeLock?.request(
            "screen",
          );
        } catch {}
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [recording]);
  const current =
    selected === "__recording__"
      ? undefined
      : meetings.find((m) => m.id === selected) || meetings[0];
  useEffect(() => {
    if (
      !current?.audioPath ||
      current.audio ||
      !session ||
      audioLoading.current.has(current.id)
    )
      return;
    audioLoading.current.add(current.id);
    const path = current.audioPath.split("/").map(encodeURIComponent).join("/");
    void fetch(
      `${SB_URL}/storage/v1/object/authenticated/meeting-media/${path}`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: "Bearer " + session.access_token,
        },
      },
    )
      .then((response) => {
        if (!response.ok)
          throw new Error("Cloud recording could not be loaded.");
        return response.blob();
      })
      .then((blob) =>
        setMeetings((items) =>
          items.map((item) =>
            item.id === current.id
              ? { ...item, audio: URL.createObjectURL(blob) }
              : item,
          ),
        ),
      )
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Cloud recording could not be loaded.",
        ),
      )
      .finally(() => audioLoading.current.delete(current.id));
  }, [current?.id, current?.audioPath, current?.audio, session]);
  const folders = useMemo(
    () =>
      [
        ...new Set(
          meetings.map((m) => m.folder?.trim()).filter(Boolean) as string[],
        ),
      ].sort(),
    [meetings],
  );
  const filtered = useMemo(
    () =>
      meetings
        .filter(
          (m) =>
            !!m.archived === showArchived &&
            (folderFilter === "all" ||
              (m.folder || "Unfiled") === folderFilter) &&
            (
              m.title +
              " " +
              m.transcript +
              " " +
              m.summary +
              " " +
              m.actions.join(" ") +
              " " +
              (m.tags || []).join(" ") +
              " " +
              (m.attendees || "") +
              " " +
              (m.agenda || "") +
              " " +
              (m.notes || "")
            )
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(!!b.favorite) - Number(!!a.favorite) ||
            +new Date(b.date) - +new Date(a.date),
        ),
    [meetings, query, showArchived, folderFilter],
  );
  const stats = useMemo(() => {
    const active = meetings.filter((m) => !m.archived && m.id !== "welcome");
    const actions = active.flatMap((m) =>
      m.actions.map((task, i) => ({ task, done: !!m.completed?.[i] })),
    );
    return {
      meetings: active.length,
      minutes: Math.round(active.reduce((n, m) => n + m.duration, 0) / 60),
      words: active.reduce(
        (n, m) => n + m.transcript.split(/\s+/).filter(Boolean).length,
        0,
      ),
      open: actions.filter((x) => !x.done).length,
      done: actions.filter((x) => x.done).length,
    };
  }, [meetings]);
  async function calendarRequest(
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    if (!session) throw new Error("Sign in before connecting a calendar.");
    const response = await fetch(`${API_BASE}/api/calendar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Calendar request failed.");
    return data;
  }
  async function loadCalendarConnections() {
    if (!session) return;
    try {
      const data = await calendarRequest("status");
      const connections: Record<string, string> = {};
      for (const item of data.connections || [])
        connections[item.provider] = item.account_email || "Connected";
      setCalendarConnections(connections);
    } catch (e) {
      setCalendarStatus(
        e instanceof Error ? e.message : "Could not load calendar connections.",
      );
    }
  }
  async function connectCalendar(provider: string) {
    try {
      setCalendarBusy(true);
      setCalendarStatus("Opening provider sign-in…");
      const data = await calendarRequest("start", { provider });
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      setCalendarStatus(
        e instanceof Error ? e.message : "Could not start calendar connection.",
      );
      setCalendarBusy(false);
    }
  }
  async function disconnectCalendar(provider: string) {
    try {
      setCalendarBusy(true);
      await calendarRequest("disconnect", { provider });
      await loadCalendarConnections();
      setCalendarStatus("Calendar disconnected.");
    } catch (e) {
      setCalendarStatus(
        e instanceof Error ? e.message : "Could not disconnect calendar.",
      );
    } finally {
      setCalendarBusy(false);
    }
  }
  async function syncCalendars() {
    try {
      setCalendarBusy(true);
      setCalendarStatus("Syncing planned meetings…");
      const planned = calendarMeetingsRef.current
        .filter((m) => m.status === "planned" && !m.archived)
        .map((m) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          duration: m.duration,
          status: m.status,
          meetingType: m.meetingType,
          attendees: m.attendees,
          agenda: m.agenda,
          notes: m.notes,
          updatedAt: m.updatedAt || new Date().toISOString(),
        }));
      const data = await calendarRequest("sync", { meetings: planned });
      const history = [
        { at: new Date().toISOString(), results: data.results || [] },
        ...calendarHistoryRef.current,
      ].slice(0, 8);
      calendarHistoryRef.current = history;
      setCalendarHistory(history);
      localStorage.setItem(
        "said-done-calendar-history",
        JSON.stringify(history),
      );
      if (Array.isArray(data.meetings) && data.meetings.length)
        setMeetings((items) =>
          items.map((item) => {
            const changed = data.meetings.find(
              (m: Meeting) => m.id === item.id,
            );
            return changed
              ? { ...item, ...changed, updatedAt: new Date().toISOString() }
              : item;
          }),
        );
      const totals = (data.results || []).map((r: any) =>
        r.error
          ? r.provider + ": " + r.error
          : r.provider +
            ": " +
            (r.created || 0) +
            " created, " +
            (r.updatedCalendar || 0) +
            " sent, " +
            (r.updatedFromCalendar || 0) +
            " received" +
            (r.conflicts?.length
              ? " · Attention: " +
                r.conflicts.map((c: any) => c.message).join(" / ")
              : ""),
      );
      setCalendarStatus(
        totals.length
          ? totals.join(" · ")
          : "Connect Google Calendar or Outlook to begin syncing.",
      );
    } catch (e) {
      setCalendarStatus(
        e instanceof Error ? e.message : "Calendar sync failed.",
      );
    } finally {
      setCalendarBusy(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    void loadCalendarConnections();
    if (calendarCallbackHandled.current) return;
    const params = new URLSearchParams(window.location.search),
      code = params.get("code"),
      state = params.get("state"),
      oauthError = params.get("error");
    if (!code && !state && !oauthError) return;
    calendarCallbackHandled.current = true;
    window.history.replaceState(
      {},
      "",
      window.location.pathname + window.location.hash,
    );
    if (oauthError) {
      setCalendarStatus("Calendar authorization was cancelled or denied.");
      return;
    }
    if (!code || !state) {
      setCalendarStatus("Calendar authorization response was incomplete.");
      return;
    }
    let provider = "";
    try {
      provider = JSON.parse(
        decodeURIComponent(
          escape(
            atob(state.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")),
          ),
        ),
      ).provider;
    } catch {}
    void (async () => {
      try {
        setCalendarBusy(true);
        await calendarRequest("complete", { code, state });
        await loadCalendarConnections();
        setCalendarStatus(
          (provider === "google" ? "Google Calendar" : "Outlook") +
            " connected. Sync to add your planned meetings.",
        );
      } catch (e) {
        setCalendarStatus(
          e instanceof Error ? e.message : "Calendar connection failed.",
        );
      } finally {
        setCalendarBusy(false);
      }
    })();
  }, [session]);
  useEffect(() => {
    if (!session || !Object.keys(calendarConnections).length) return;
    const run = () => void syncCalendars();
    const initial = window.setTimeout(run, 1500);
    const interval = window.setInterval(run, 300000);
    let focusTimer: number | undefined;
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(run, 700);
    };
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.clearTimeout(focusTimer);
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [session, calendarConnections]);
  function newMeeting() {
    const m: Meeting = {
      id: crypto.randomUUID(),
      title: "Untitled meeting",
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      duration: 0,
      language,
      meetingType: "general",
      status: "planned",
      transcript: "",
      summary: "",
      actions: [],
      actionDetails: [],
      completed: [],
      tags: [],
    };
    setMeetings((v) => [m, ...v]);
    setSelected(m.id);
    setShowArchived(false);
    setShowDashboard(false);
  }
  function startMobileMeeting() {
    setSelected("__recording__");
    setConsent(false);
    setElapsed(0);
    setLive("");
    setError("");
    setMobileView("record");
  }
  function scheduleMobileMeeting() {
    newMeeting();
    setMobileView("detail");
  }
  function leaveMobileRecorder() {
    if (recording) {
      setError("Stop the recording before leaving this screen.");
      return;
    }
    setConsent(false);
    setSelected(meetings[0]?.id || "");
    setMobileView("home");
  }
  function openMobileMeeting(id: string) {
    setSelected(id);
    setShowDashboard(false);
    setMobileView("detail");
  }
  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }
  async function uploadRecording(blob: Blob, m: Meeting) {
    if (!session) return;
    const extension = blob.type.includes("mp4")
      ? "mp4"
      : blob.type.includes("mpeg")
        ? "mp3"
        : "webm";
    const path = `${session.user.id}/${m.id}.${extension}`;
    try {
      await setRecordingBackupStatus(m.localRecordingId || m.id, "uploading");
      setMeetings((items) =>
        items.map((item) =>
          item.id === m.id
            ? { ...item, recordingBackupStatus: "uploading" }
            : item,
        ),
      );
      setCloudStatus("Uploading recording securely…");
      await new Promise<void>((resolve, reject) => {
        const upload = new TusUpload(blob, {
          endpoint:
            "https://bazjlrualnmbanmhiuau.storage.supabase.co/storage/v1/upload/resumable",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: "Bearer " + session.access_token,
            apikey: SB_KEY,
            "x-upsert": "true",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: 6 * 1024 * 1024,
          metadata: {
            bucketName: "meeting-media",
            objectName: path,
            contentType: blob.type || "audio/webm",
            cacheControl: "3600",
          },
          onError: reject,
          onSuccess: () => resolve(),
        });
        void upload
          .findPreviousUploads()
          .then((previous) => {
            if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
            upload.start();
          })
          .catch(reject);
      });
      await setRecordingBackupStatus(m.localRecordingId || m.id, "cloud", path);
      setMeetings((items) =>
        items.map((item) =>
          item.id === m.id
            ? { ...item, audioPath: path, recordingBackupStatus: "cloud" }
            : item,
        ),
      );
      setCloudStatus("Recording backed up securely");
    } catch (e) {
      await setRecordingBackupStatus(
        m.localRecordingId || m.id,
        "failed",
      ).catch(() => {});
      setMeetings((items) =>
        items.map((item) =>
          item.id === m.id
            ? { ...item, recordingBackupStatus: "failed" }
            : item,
        ),
      );
      setError(
        (e instanceof Error ? e.message : "Cloud recording upload failed") +
          " The local recovery copy is still safe.",
      );
      setCloudStatus("");
    }
  }
  async function start() {
    if (!consent) {
      setError("Confirm that everyone has agreed to the recording.");
      return;
    }
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (
        estimate?.quota &&
        estimate.usage &&
        estimate.quota - estimate.usage < 25 * 1024 * 1024
      ) {
        setError(
          "This device is nearly out of storage. Free some space before recording.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const options = { audioBitsPerSecond: 16000 };
      let mr: MediaRecorder;
      try {
        mr = new MediaRecorder(stream, options);
      } catch {
        mr = new MediaRecorder(stream);
      }
      const id = crypto.randomUUID();
      recordingId.current = id;
      recordingStartedAt.current = Date.now();
      chunkSequence.current = 0;
      chunkWrites.current = Promise.resolve();
      await beginRecording(id, mr.mimeType);
      void navigator.storage?.persist?.();
      media.current = mr;
      mr.ondataavailable = (e) => {
        if (!e.data.size) return;
        const sequence = chunkSequence.current++;
        const duration = Math.max(
          1,
          Math.round((Date.now() - recordingStartedAt.current) / 1000),
        );
        chunkWrites.current = chunkWrites.current
          .then(() => appendRecordingChunk(id, sequence, e.data, duration))
          .catch(() => {
            setError(
              "This device could not save the recording. Keep this page open and stop the recording soon.",
            );
          });
      };
      mr.onerror = () => {
        setError(
          "The browser reported a recording error. Saving everything captured so far…",
        );
        stop();
      };
      mr.start(5000);
      pausedTotal.current = 0;
      pausedAt.current = 0;
      recordingTarget.current =
        current && current.status === "planned" && !current.localRecordingId
          ? current.id
          : null;
      setLive("");
      setElapsed(0);
      setPaused(false);
      setRecording(true);
      try {
        wakeLock.current = await (navigator as any).wakeLock?.request("screen");
      } catch {}
      timer.current = window.setInterval(() => setElapsed((v) => v + 1), 1000);
      await new Promise(requestAnimationFrame);
      const SR =
        !isIOSDevice() &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition);
      if (SR) {
        try {
          const r = new SR();
          r.continuous = true;
          r.interimResults = true;
          r.onresult = (e: any) => {
            let text = "";
            for (let i = 0; i < e.results.length; i++)
              text += e.results[i][0].transcript + " ";
            setLive(text.trim());
          };
          r.onerror = () => {};
          r.start();
          recognition.current = r;
        } catch {
          recognition.current = null;
        }
      }
    } catch (e) {
      setRecording(false);
      setError(
        e instanceof Error
          ? e.message
          : "Microphone access is required to record a meeting.",
      );
    }
  }
  async function analyzeMeeting(m: Meeting) {
    setProcessing("Generating AI meeting notes…");
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: m.title,
        transcript: m.transcript,
        meetingType: m.meetingType || "general",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Analysis failed");
    const list = (value: unknown) =>
      Array.isArray(value) ? value.filter(Boolean).map(String) : [];
    const items: ActionItem[] = Array.isArray(data.action_items)
      ? data.action_items.filter((x: ActionItem) => x && x.task)
      : [];
    const updated = {
      ...m,
      summary: String(data.summary || m.summary || ""),
      actions: items.map((x) => x.task),
      actionDetails: items,
      completed: items.map(() => false),
      keyPoints: list(data.key_points),
      decisions: list(data.decisions),
      topics: list(data.topics),
      followUp: list(data.follow_up),
      openQuestions: list(data.open_questions),
      risks: list(data.risks),
    };
    setMeetings((v) =>
      v.map((x) =>
        x.id === m.id
          ? { ...x, ...updated, audioPath: x.audioPath || updated.audioPath }
          : x,
      ),
    );
    return updated;
  }
  async function queueBackgroundTranscription(
    blob: Blob,
    meeting: Meeting,
    retry = false,
  ) {
    if (!session || !navigator.onLine) return false;
    try {
      setError("");
      setProcessing("Preparing secure background transcription…");
      setMeetings((items) =>
        items.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                transcriptionState: "uploading",
                transcriptionProgress: 0,
                transcriptionError: undefined,
              }
            : item,
        ),
      );
      const parts = await createTranscriptionParts(
        blob,
        BACKGROUND_TRANSCRIPTION_PART_SECONDS,
        (f) => setProcessing(`Preparing recording… ${Math.round(f * 100)}%`),
      );
      const chunks = [];
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        const path = `${session.user.id}/${meeting.id}/${String(index).padStart(3, "0")}.wav`;
        setProcessing(
          `Uploading transcription audio… (${index + 1}/${parts.length})`,
        );
        const upload = await fetch(
          `${SB_URL}/storage/v1/object/meeting-transcription-chunks/${path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
          {
            method: "POST",
            headers: {
              apikey: SB_KEY,
              authorization: "Bearer " + session.access_token,
              "content-type": "audio/wav",
              "x-upsert": "true",
            },
            body: part,
          },
        );
        if (!upload.ok) throw new Error("Secure chunk upload failed.");
        chunks.push({
          storagePath: path,
          durationSeconds: Math.min(
            BACKGROUND_TRANSCRIPTION_PART_SECONDS,
            Math.max(
              1,
              meeting.duration - index * BACKGROUND_TRANSCRIPTION_PART_SECONDS,
            ),
          ),
          bytes: part.size,
        });
      }
      const requestId = crypto.randomUUID();
      const response = await fetch(`${API_BASE}/api/transcription-jobs/create`, {
        method: "POST",
        headers: {
          authorization: "Bearer " + session.access_token,
          "content-type": "application/json",
          "x-client-request-id": requestId,
          "idempotency-key": `${session.user.id}:${meeting.id}:${retry ? Date.now() : "v1"}`,
        },
        body: JSON.stringify({
          meetingId: meeting.id,
          language: meeting.language || language,
          chunks,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.jobId)
        throw new Error(
          data?.error || `Background queue is unavailable. Reference: ${requestId}`,
        );
      setMeetings((items) =>
        items.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                transcriptionJobId: data.jobId,
                transcriptionState: "queued",
                transcriptionProgress: 0,
                transcript: "Transcription queued safely. You may close the app.",
                transcriptionError: undefined,
              }
            : item,
        ),
      );
      setProcessing("");
      return true;
    } catch (exception) {
      const detail =
        exception instanceof Error
          ? exception.message
          : "Background queue is unavailable.";
      console.warn("Background transcription fallback:", detail);
      setMeetings((items) =>
        items.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                transcriptionState: "failed",
                transcriptionProgress: 0,
                transcriptionError: `Background transcription could not start. Your recording is safe. ${detail}`,
              }
            : item,
        ),
      );
      setProcessing("");
      return false;
    }
  }
  async function pollTranscriptionJob(meeting: Meeting) {
    const jobId = meeting.transcriptionJobId;
    if (!session || !jobId || jobPolling.current.has(jobId)) return;
    jobPolling.current.add(jobId);
    try {
      const response = await fetch(
        `${API_BASE}/api/transcription-jobs/status?id=${encodeURIComponent(jobId)}`,
        { headers: { authorization: "Bearer " + session.access_token } },
      );
      const job = await response.json();
      if (!response.ok)
        throw new Error(job.error || "Transcription status is unavailable.");
      const state = job.status as TranscriptionState;
      const progress = Math.max(0, Math.min(1, Number(job.progress) || 0));
      if (state === "complete") {
        const segments: TranscriptSegment[] = [];
        let offset = 0;
        for (const envelope of Array.isArray(job.segments) ? job.segments : []) {
          for (const segment of Array.isArray(envelope.segments)
            ? envelope.segments
            : [])
            segments.push({
              speaker: String(segment.speaker || "Speaker"),
              text: String(segment.text || ""),
              start: (Number(segment.start) || 0) + offset,
              end: (Number(segment.end) || 0) + offset,
            });
          offset +=
            Number(envelope.durationSeconds) || TRANSCRIPTION_PART_SECONDS;
        }
        const transcript = segments.length
          ? segments
              .map(
                (segment) =>
                  `[${fmt(Math.round(segment.start))}] ${segment.speaker}: ${segment.text}`,
              )
              .join("\n")
          : String(job.transcript || "").trim();
        if (!transcript)
          throw new Error("No speech was detected in this recording.");
        const withTranscript: Meeting = {
          ...meeting,
          transcript,
          transcriptSegments: segments,
          duration:
            meeting.duration ||
            Math.round(Number(job.duration_seconds) || offset),
          transcriptionState: "complete",
          transcriptionProgress: 1,
          transcriptionError: undefined,
        };
        setMeetings((items) =>
          items.map((item) =>
            item.id === meeting.id
              ? { ...item, ...withTranscript }
              : item,
          ),
        );
        await analyzeMeeting(withTranscript);
        return;
      }
      setMeetings((items) =>
        items.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                transcriptionState: state,
                transcriptionProgress: progress,
                transcriptionError: job.last_error || undefined,
              }
            : item,
        ),
      );
    } catch (exception) {
      setMeetings((items) =>
        items.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                transcriptionError:
                  exception instanceof Error
                    ? exception.message
                    : "Could not refresh transcription status.",
              }
            : item,
        ),
      );
    } finally {
      jobPolling.current.delete(jobId);
    }
  }
  async function processAudio(
    blob: Blob,
    m: Meeting,
    preferBackground = true,
  ) {
    // Background (server-side) transcription needs a signed-in account. When
    // there is no session, or the queue cannot start, transcribe directly from
    // this device instead of leaving the meeting stuck.
    if (preferBackground && session && navigator.onLine) {
      if (await queueBackgroundTranscription(blob, m)) return;
    }
    if (localTranscriptionRunning.current.has(m.id)) return;
    localTranscriptionRunning.current.add(m.id);
    let activePart = 0,
      totalParts = 0,
      checkpointParts: TranscriptionPartCheckpoint[] = [];
    const buildSnapshot = (completed: TranscriptionPartCheckpoint[]) => {
      const ordered = [...completed].sort((a, b) => a.index - b.index),
        segments = ordered.flatMap((part) => part.segments),
        transcript = ordered
          .map((part) =>
            part.segments.length
              ? part.segments
                  .map(
                    (segment) =>
                      `[${fmt(Math.round(segment.start))}] ${segment.speaker}: ${segment.text}`,
                  )
                  .join("\n")
              : part.transcript,
          )
          .filter(Boolean)
          .join("\n\n"),
        duration = ordered.reduce((total, part) => total + part.duration, 0);
      return { ordered, segments, transcript, duration };
    };
    try {
      setError("");
      setProcessing("Preparing recording…");
      setMeetings((items) =>
        items.map((item) =>
          item.id === m.id
            ? {
                ...item,
                transcriptionState: "processing",
                transcriptionError: undefined,
                summary:
                  !item.summary ||
                  /not available|no discussion took place|recovered from|will appear after transcription|creating ai meeting notes/i.test(
                    item.summary,
                  )
                    ? "Transcription is in progress. You can leave this meeting and return; completed parts are saved automatically."
                    : item.summary,
              }
            : item,
        ),
      );
      const parts = await createTranscriptionParts(
        blob,
        TRANSCRIPTION_PART_SECONDS,
        (f) => setProcessing(`Preparing recording… ${Math.round(f * 100)}%`),
      );
      totalParts = parts.length;
      const saved = loadTranscriptionCheckpoint(m.id);
      if (
        saved?.partSeconds === TRANSCRIPTION_PART_SECONDS &&
        saved.totalParts === totalParts
      )
        checkpointParts = saved.completed.filter(
          (part) =>
            Number.isInteger(part.index) &&
            part.index >= 0 &&
            part.index < totalParts,
        );
      const completedByIndex = new Map(
        checkpointParts.map((part) => [part.index, part]),
      );
      const initial = buildSnapshot([...completedByIndex.values()]);
      setMeetings((items) =>
        items.map((item) =>
          item.id === m.id
            ? {
                ...item,
                transcriptionState: completedByIndex.size
                  ? "retrying"
                  : "processing",
                transcriptionProgress: completedByIndex.size / totalParts,
                transcriptionCompletedParts: completedByIndex.size,
                transcriptionTotalParts: totalParts,
                transcript: initial.transcript || item.transcript,
                transcriptSegments: initial.segments.length
                  ? initial.segments
                  : item.transcriptSegments,
              }
            : item,
        ),
      );
      const pendingIndexes = parts
        .map((_, index) => index)
        .filter((index) => !completedByIndex.has(index));
      let nextPendingIndex = 0;
      const transcribeNext = async () => {
        while (nextPendingIndex < pendingIndexes.length) {
          const index = pendingIndexes[nextPendingIndex++];
          if (completedByIndex.has(index)) continue;
        activePart = index + 1;
        const part = parts[index];
        if (part.size > 4 * 1024 * 1024)
          throw new Error(
            "An audio part is too large to upload. Your recording is safe; refresh the app to load the latest audio encoder.",
          );
        setProcessing(
          parts.length > 1
            ? `${completedByIndex.size ? "Resuming" : "Transcribing"} recording… (${index + 1}/${parts.length})`
            : "Transcribing recording…",
        );
        const form = new FormData(),
          extension = part.type.includes("wav")
            ? "wav"
            : part.type.includes("mp4")
              ? "mp4"
              : "webm";
        form.append("audio", part, `meeting-${index + 1}.${extension}`);
        form.append("language", m.language || language);
        if (m.customVocabulary?.trim())
          form.append("prompt", m.customVocabulary.trim());
        let response: Response | undefined;
        for (let attempt = 0; attempt < 3 && !response; attempt++) {
          try {
            response = await fetch(`${API_BASE}/api/transcribe`, {
              method: "POST",
              body: form,
            });
          } catch {
            if (attempt === 2)
              throw new Error(
                "The connection dropped. Completed parts are saved and will not be repeated.",
              );
            await new Promise((resolve) =>
              setTimeout(resolve, 1500 * (attempt + 1)),
            );
          }
        }
        if (!response) throw new Error("Transcription request failed.");
        const raw = await response.text();
        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          const looksLikeHtml = /^\s*</.test(raw);
          throw new Error(
            response.ok
              ? "The transcription service returned an invalid response."
              : looksLikeHtml
                ? "The transcription service is temporarily unavailable. Your recording is safe; please try again shortly."
                : raw.slice(0, 240) ||
                  `Transcription failed (${response.status}).`,
          );
        }
        if (!response.ok)
          throw new Error(
            data.error || `Transcription failed (${response.status}).`,
          );
        const offset = index * TRANSCRIPTION_PART_SECONDS,
          partSegments: TranscriptSegment[] = Array.isArray(data.segments)
          ? data.segments
              .filter((x: any) => x && typeof x.text === "string")
              .map((x: any) => ({
                speaker: String(x.speaker || "Speaker"),
                text: String(x.text),
                start: (Number(x.start) || 0) + offset,
                end: (Number(x.end) || 0) + offset,
              }))
          : [];
        const completedPart: TranscriptionPartCheckpoint = {
          index,
          duration:
            Number(data.duration) ||
            Math.min(
              TRANSCRIPTION_PART_SECONDS,
              Math.max(1, m.duration - offset),
            ),
          transcript:
            typeof data.transcript === "string" ? data.transcript.trim() : "",
          segments: partSegments,
        };
        completedByIndex.set(index, completedPart);
        checkpointParts = [...completedByIndex.values()];
        saveTranscriptionCheckpoint(m.id, {
          version: 2,
          partSeconds: TRANSCRIPTION_PART_SECONDS,
          totalParts,
          completed: checkpointParts,
          updatedAt: new Date().toISOString(),
        });
        const partial = buildSnapshot(checkpointParts);
        setMeetings((items) =>
          items.map((item) =>
            item.id === m.id
              ? {
                  ...item,
                  transcriptionState: "processing",
                  transcriptionProgress: completedByIndex.size / totalParts,
                  transcriptionCompletedParts: completedByIndex.size,
                  transcriptionTotalParts: totalParts,
                  transcriptionError: undefined,
                  transcript: partial.transcript || item.transcript,
                  transcriptSegments: partial.segments,
                }
              : item,
          ),
        );
        }
      };
      await Promise.all(
        Array.from(
          {
            length: Math.min(
              TRANSCRIPTION_CONCURRENCY,
              pendingIndexes.length,
            ),
          },
          () => transcribeNext(),
        ),
      );
      const completed = buildSnapshot([...completedByIndex.values()]),
        transcript = completed.transcript;
      if (!transcript)
        throw new Error("No speech was detected in this recording.");
      const withTranscript = {
        ...m,
        transcript,
        transcriptSegments: completed.segments,
        duration: m.duration || Math.round(completed.duration),
        transcriptionState: "complete" as const,
        transcriptionProgress: 1,
        transcriptionCompletedParts: totalParts,
        transcriptionTotalParts: totalParts,
        transcriptionError: undefined,
      };
      setMeetings((v) =>
        v.map((x) => (x.id === m.id ? { ...x, ...withTranscript } : x)),
      );
      clearTranscriptionCheckpoint(m.id);
      try {
        await analyzeMeeting(withTranscript);
      } catch (analysisError) {
        const detail =
          analysisError instanceof Error
            ? analysisError.message
            : "Meeting-note generation failed.";
        setError(`Transcript complete, but the summary could not be generated. ${detail}`);
        setMeetings((items) =>
          items.map((item) =>
            item.id === m.id
              ? { ...item, transcriptionState: "complete", transcriptionError: detail }
              : item,
          ),
        );
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "AI processing failed";
      const partial = buildSnapshot(checkpointParts),
        completedCount = checkpointParts.length,
        message =
          totalParts > 1
            ? `Transcription paused after saving ${completedCount} of ${totalParts} parts. Resume to continue with part ${Math.min(completedCount + 1, totalParts)}. ${detail}`
            : detail;
      setError(message);
      setMeetings((items) =>
        items.map((item) =>
          item.id === m.id
            ? {
                ...item,
                transcriptionState: completedCount ? "partial" : "failed",
                transcriptionProgress: totalParts
                  ? completedCount / totalParts
                  : 0,
                transcriptionCompletedParts: completedCount,
                transcriptionTotalParts: totalParts || undefined,
                transcriptionError: message,
                transcript: partial.transcript || item.transcript,
                transcriptSegments: partial.segments.length
                  ? partial.segments
                  : item.transcriptSegments,
              }
            : item,
        ),
      );
    } finally {
      localTranscriptionRunning.current.delete(m.id);
      setProcessing("");
    }
  }
  async function retryTranscription() {
    if (!current?.localRecordingId) {
      setError("The original recording is not available on this device.");
      return;
    }
    const target = current;
    try {
      setProcessing("Loading saved recording…");
      const stored = await getRecording(target.localRecordingId!);
      if (!stored?.blob.size)
        throw new Error(
          "The saved recording could not be found on this device.",
        );
      await processAudio(
        stored.blob,
        { ...target, transcriptionJobId: undefined },
        true,
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "The saved recording could not be loaded.";
      setError(message);
      setMeetings((items) =>
        items.map((item) =>
          item.id === target.id
            ? { ...item, transcriptionState: "failed", transcriptionError: message }
            : item,
        ),
      );
      setProcessing("");
    }
  }
  function stop() {
    const mr = media.current;
    if (!mr) {
      setRecording(false);
      return;
    }
    const id = recordingId.current;
    let finished = false;
    const finish = async () => {
      if (finished) return;
      finished = true;
      try {
        await chunkWrites.current;
        if (!id) throw new Error("The recording identifier was lost.");
        const pausedMs =
          pausedTotal.current +
          (pausedAt.current ? Date.now() - pausedAt.current : 0);
        const capturedDuration = Math.max(
          1,
          Math.round(
            (Date.now() - recordingStartedAt.current - pausedMs) / 1000,
          ),
        );
        await completeRecording(id, capturedDuration);
        const stored = await getRecording(id);
        if (!stored?.blob.size) throw new Error("No recorded audio was found.");
        const blob = stored.blob;
        const audio = URL.createObjectURL(blob);
        const text = live.trim();
        const result = summarize(text);
        const target = recordingTarget.current
          ? meetings.find((item) => item.id === recordingTarget.current)
          : undefined;
        const startedAt = new Date(stored.startedAt);
        const base: Meeting = {
          id,
          title: `Meeting · ${startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${startedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
          date: stored.startedAt,
          duration: capturedDuration,
          language,
          status: "complete",
          transcript: "",
          summary: "",
          actions: [],
        };
        const m: Meeting = {
          ...(target || base),
          date: target ? target.date : stored.startedAt,
          duration: capturedDuration,
          status: "complete",
          transcript: text || "Processing audio…",
          summary: text
            ? result.summary
            : "Your AI summary will appear after transcription.",
          actions: result.actions,
          completed: result.actions.map(() => false),
          audio,
          localRecordingId: id,
          recordingBackupStatus: stored.backupStatus,
          updatedAt: new Date().toISOString(),
        };
        recordingTarget.current = null;
        setMeetings((v) => [
          m,
          ...v.filter((item) => item.id !== id && item.id !== m.id),
        ]);
        setSelected(m.id);
        setMobileView("detail");
        if (session) void uploadRecording(blob, m);
        void processAudio(blob, m);
      } catch (e) {
        setError(
          (e instanceof Error ? e.message : "Recording recovery failed") +
            " Do not clear this site’s data; the saved recording may still be recoverable.",
        );
      } finally {
        media.current = null;
        recordingId.current = null;
      }
    };
    mr.onstop = () => void finish();
    try {
      if (mr.state !== "inactive") mr.stop();
      else void finish();
    } catch {
      void finish();
    }
    mr.stream.getTracks().forEach((t) => t.stop());
    try {
      recognition.current?.stop();
    } catch {}
    recognition.current = null;
    clearInterval(timer.current);
    try {
      wakeLock.current?.release();
    } catch {}
    wakeLock.current = null;
    setPaused(false);
    setRecording(false);
  }
  function pauseRecording() {
    const mr = media.current;
    if (!mr) return;
    try {
      if (mr.state === "recording") {
        mr.pause();
        setPaused(true);
        pausedAt.current = Date.now();
        clearInterval(timer.current);
      } else if (mr.state === "paused") {
        mr.resume();
        setPaused(false);
        if (pausedAt.current)
          pausedTotal.current += Date.now() - pausedAt.current;
        pausedAt.current = 0;
        timer.current = window.setInterval(
          () => setElapsed((v) => v + 1),
          1000,
        );
      }
    } catch {
      setError("Pause or resume is not supported on this browser.");
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      setError("Choose an audio or video file smaller than 200 MB.");
      return;
    }
    const id = crypto.randomUUID();
    let duration = 0;
    try {
      duration = await new Promise<number>((resolve) => {
        const probe = document.createElement("audio");
        probe.preload = "metadata";
        probe.onloadedmetadata = () =>
          resolve(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0);
        probe.onerror = () => resolve(0);
        probe.src = URL.createObjectURL(file);
        setTimeout(() => resolve(0), 4000);
      });
    } catch {}
    let localRecordingId: string | undefined;
    try {
      await beginRecording(id, file.type || "audio/mp4");
      await appendRecordingChunk(id, 0, file, duration);
      await completeRecording(id, duration);
      localRecordingId = id;
    } catch {
      /* storage full: still transcribe this session */
    }
    const m: Meeting = {
      id,
      title: file.name.replace(/\.[^.]+$/, ""),
      date: new Date().toISOString(),
      duration,
      status: "complete",
      transcript: "Processing audio…",
      summary: "Your AI summary will appear after transcription.",
      actions: [],
      audio: URL.createObjectURL(file),
      localRecordingId,
    };
    setMeetings((v) => [m, ...v]);
    setSelected(m.id);
    setMobileView("detail");
    void processAudio(file, m);
  }
  async function authenticate() {
    try {
      setError("");
      setCloudStatus(
        authMode === "signup" ? "Creating account…" : "Signing in…",
      );
      const path =
        authMode === "signup"
          ? "/auth/v1/signup"
          : "/auth/v1/token?grant_type=password";
      const response = await fetch(SB_URL + path, {
        method: "POST",
        headers: { apikey: SB_KEY, "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.msg || data.error_description || "Sign-in failed");
      if (!data.access_token) {
        setCloudStatus(
          "Check your email to confirm your account, then sign in.",
        );
        return;
      }
      setSession(data);
      setPassword("");
      setCloudStatus("Signed in. Loading cloud meetings…");
      await loadCloud(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setCloudStatus("");
    }
  }
  async function loadCloud(active = session) {
    if (!active) return;
    try {
      setCloudStatus("Loading cloud meetings…");
      const response = await fetch(
        SB_URL + "/rest/v1/mn_meetings?select=*&order=created_at.desc",
        {
          headers: {
            apikey: SB_KEY,
            Authorization: "Bearer " + active.access_token,
          },
        },
      );
      const rows = await response.json();
      if (!response.ok) throw new Error(rows.message || "Cloud load failed");
      const cloud: Meeting[] = rows.map((r: any) => ({
        id: r.id,
        updatedAt: r.updated_at || r.created_at,
        title: r.title,
        date: r.started_at || r.created_at,
        duration: r.duration_seconds,
        transcript: r.transcript,
        summary: r.summary,
        audioPath: r.audio_path || undefined,
        actions: r.metadata?.actions || [],
        actionDetails: r.metadata?.actionDetails || [],
        keyPoints: r.metadata?.keyPoints || [],
        decisions: r.decisions || [],
        topics: r.key_topics || [],
        followUp: r.follow_up_agenda || [],
        openQuestions: r.open_questions || [],
        risks: r.risks || [],
        meetingType: r.meeting_type || "general",
        language: r.language || "auto",
        tags: r.metadata?.tags || [],
        completed: r.metadata?.completed || [],
        favorite: !!r.metadata?.favorite,
        transcriptSegments: r.metadata?.transcriptSegments || [],
        speakerNames: r.metadata?.speakerNames || {},
        customVocabulary: r.metadata?.customVocabulary || "",
        transcriptionJobId: r.metadata?.transcriptionJobId,
        transcriptionState: r.metadata?.transcriptionState,
        transcriptionProgress: r.metadata?.transcriptionProgress,
        transcriptionCompletedParts:
          r.metadata?.transcriptionCompletedParts,
        transcriptionTotalParts: r.metadata?.transcriptionTotalParts,
        transcriptionError: r.metadata?.transcriptionError,
        attendees: r.metadata?.attendees || "",
        agenda: r.metadata?.agenda || "",
        folder: r.metadata?.folder || "",
        notes: r.metadata?.notes || "",
        followupEmail: r.metadata?.followupEmail || "",
        archived: !!r.metadata?.archived,
        status: r.status === "planned" ? "planned" : "complete",
      }));
      if (cloud.length) {
        setMeetings((v) => {
          const map = new Map(v.map((x) => [x.id, x]));
          cloud.forEach((x) =>
            map.set(x.id, {
              ...map.get(x.id),
              ...x,
              audio: map.get(x.id)?.audio,
              localRecordingId: map.get(x.id)?.localRecordingId,
            }),
          );
          return [...map.values()].sort(
            (a, b) => +new Date(b.date) - +new Date(a.date),
          );
        });
        setSelected(cloud[0].id);
      }
      setCloudStatus("Cloud sync ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cloud load failed");
      setCloudStatus("");
    }
  }
  async function syncCloud() {
    if (!session) return;
    try {
      setCloudStatus("Syncing…");
      const valid = meetings.filter((m) => m.id !== "welcome");
      if (!valid.length) {
        setCloudStatus("Nothing to sync yet");
        return;
      }
      const rows = valid.map((m) => ({
        id: m.id,
        user_id: session.user.id,
        title: m.title,
        meeting_type: m.meetingType || "general",
        status: m.status || "complete",
        language: m.language === "auto" ? "en" : m.language || "en",
        started_at: m.date,
        updated_at: m.updatedAt || new Date().toISOString(),
        duration_seconds: m.duration,
        audio_path: m.audioPath || null,
        transcript: m.transcript,
        summary: m.summary,
        decisions: m.decisions || [],
        open_questions: m.openQuestions || [],
        risks: m.risks || [],
        follow_up_agenda: m.followUp || [],
        key_topics: m.topics || [],
        source: "pwa",
        metadata: {
          actions: m.actions,
          actionDetails: m.actionDetails,
          keyPoints: m.keyPoints,
          tags: m.tags || [],
          completed: m.completed || [],
          favorite: !!m.favorite,
          transcriptSegments: m.transcriptSegments || [],
          speakerNames: m.speakerNames || {},
          customVocabulary: m.customVocabulary || "",
          transcriptionJobId: m.transcriptionJobId,
          transcriptionState: m.transcriptionState,
          transcriptionProgress: m.transcriptionProgress,
          transcriptionCompletedParts: m.transcriptionCompletedParts,
          transcriptionTotalParts: m.transcriptionTotalParts,
          transcriptionError: m.transcriptionError,
          attendees: m.attendees || "",
          agenda: m.agenda || "",
          folder: m.folder || "",
          notes: m.notes || "",
          followupEmail: m.followupEmail || "",
          archived: !!m.archived,
        },
      }));
      const response = await fetch(
        SB_URL + "/rest/v1/mn_meetings?on_conflict=id",
        {
          method: "POST",
          headers: {
            apikey: SB_KEY,
            Authorization: "Bearer " + session.access_token,
            "content-type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(rows),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Sync failed");
      }
      setCloudStatus("Synced across devices");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
      setCloudStatus("");
    }
  }
  function signOut() {
    setSession(null);
    setCloudStatus("");
    setPassword("");
  }
  function update(p: Partial<Meeting>) {
    if (!current) return;
    setMeetings((v) =>
      v.map((m) =>
        m.id === current.id
          ? { ...m, ...p, updatedAt: new Date().toISOString() }
          : m,
      ),
    );
  }
  async function regenerate() {
    if (!current) return;
    if (!hasRealTranscript(current.transcript)) {
      setError(
        current.localRecordingId
          ? "There is no transcript yet. Transcribe the recording first."
          : "Add a transcript first, then generate the summary.",
      );
      return;
    }
    try {
      setError("");
      await analyzeMeeting(current);
      notify("Summary updated");
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Analysis failed";
      if (!current.summary || !hasRealTranscript(current.summary)) {
        update(summarize(current.transcript));
        setError(detail + " A basic local summary was created instead.");
      } else setError(detail);
    } finally {
      setProcessing("");
    }
  }
  async function ask() {
    if (!current || !question.trim()) return;
    try {
      setProcessing("Searching this meeting…");
      setError("");
      const response = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          transcript: current.transcript,
          summary: current.summary,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Question failed");
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Question failed");
    } finally {
      setProcessing("");
    }
  }
  function renameSpeaker(speaker: string, name: string) {
    if (!current) return;
    update({
      speakerNames: { ...(current.speakerNames || {}), [speaker]: name },
    });
  }
  function addAction() {
    if (!current) return;
    update({
      actions: [...current.actions, "New action item"],
      actionDetails: [
        ...(current.actionDetails || []),
        { task: "New action item", owner: null, due: null, priority: "medium" },
      ],
      completed: [...(current.completed || []), false],
    });
  }
  function updateActionDetail(i: number, patch: Partial<ActionItem>) {
    if (!current) return;
    const details = current.actions.map((task, n) => ({
      ...({ task, owner: null, due: null, priority: "medium" } as ActionItem),
      ...(current.actionDetails?.[n] || {}),
      task,
    }));
    details[i] = { ...details[i], ...patch };
    update({ actionDetails: details });
  }
  function removeAction(i: number) {
    if (!current) return;
    update({
      actions: current.actions.filter((_, n) => n !== i),
      actionDetails: current.actionDetails?.filter((_, n) => n !== i),
      completed: (current.completed || []).filter((_, n) => n !== i),
    });
  }
  function toggleAction(i: number) {
    if (!current) return;
    const next = [...(current.completed || [])];
    next[i] = !next[i];
    update({ completed: next });
  }
  function addTag(value: string) {
    if (!current) return;
    const tag = value.trim().replace(/^#/, "");
    if (!tag) return;
    const exists = [...(current.tags || []), ...(current.topics || [])].some(
      (t) => t.toLowerCase() === tag.toLowerCase(),
    );
    if (exists) return;
    update({ tags: [...(current.tags || []), tag] });
  }
  function backupLibrary() {
    downloadFile(
      "meeting-notes-backup-" + new Date().toISOString().slice(0, 10) + ".json",
      JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), meetings },
        null,
        2,
      ),
      "application/json",
    );
  }
  async function restoreBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.meetings;
      if (!Array.isArray(incoming))
        throw new Error("This is not a Said and Done backup.");
      const valid: Meeting[] = incoming
        .filter(
          (m: any) =>
            m &&
            typeof m.id === "string" &&
            typeof m.title === "string" &&
            typeof m.transcript === "string",
        )
        .map((m: any) => ({
          ...m,
          actions: Array.isArray(m.actions) ? m.actions : [],
          date: m.date || new Date().toISOString(),
          duration: Number(m.duration) || 0,
          summary: m.summary || "",
        }));
      if (!valid.length)
        throw new Error("No meetings were found in this backup.");
      setMeetings((existing) => {
        const map = new Map(existing.map((m) => [m.id, m]));
        valid.forEach((m) => map.set(m.id, m));
        return [...map.values()];
      });
      setSelected(valid[0].id);
      setCloudStatus(
        `Restored ${valid.length} meeting${valid.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup restore failed");
    } finally {
      e.target.value = "";
    }
  }
  async function shareMeeting() {
    if (!current) return;
    const text = `${current.title}\n\n${current.summary}\n\nAction items:\n${current.actions.map((x, i) => `${current.completed?.[i] ? "✓" : "•"} ${x}`).join("\n")}`;
    try {
      if (navigator.share)
        await navigator.share({ title: current.title, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Notes copied to share");
      }
    } catch {}
  }
  function archiveMeeting() {
    if (!current || current.id === "welcome") return;
    update({ archived: true });
    const next = meetings.find((m) => m.id !== current.id && !m.archived);
    setSelected(next?.id || "welcome");
    setMobileView("home");
    notify("Meeting archived");
  }
  function restoreMeeting() {
    if (!current) return;
    update({ archived: false });
    setShowArchived(false);
  }
  function deleteForever() {
    if (
      !current ||
      !confirm("Permanently delete this meeting? This cannot be undone.")
    )
      return;
    const next = meetings.filter((m) => m.id !== current.id);
    setMeetings(next);
    setSelected(
      next.find((m) => !!m.archived === showArchived)?.id || next[0]?.id || "",
    );
    setMobileView("home");
    notify("Meeting deleted");
  }
  function downloadFile(name: string, body: string, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportMeeting(
    format: "txt" | "md" | "json" | "csv" | "ics" | "srt" | "vtt",
  ) {
    if (!current) return;
    const section = (name: string, items?: string[]) =>
      items?.length
        ? `\n\n${name.toUpperCase()}\n${items.map((x) => "• " + x).join("\n")}`
        : "";
    const text = `${current.title}\n${new Date(current.date).toLocaleString()}\nType: ${current.meetingType || "general"}\nAttendees: ${current.attendees || "Not listed"}\n\nSUMMARY\n${current.summary}${section("Key points", current.keyPoints)}${section("Decisions", current.decisions)}${section("Action items", current.actions)}${section("Open questions", current.openQuestions)}${section("Risks", current.risks)}${section("Follow-up agenda", current.followUp)}\n\nNOTES\n${current.notes || ""}\n\nTRANSCRIPT\n${current.transcript}`;
    const base = safeName(current.title);
    if (format === "srt" || format === "vtt") {
      const segments = current.transcriptSegments?.length
        ? current.transcriptSegments
        : [
            {
              speaker: "Speaker",
              text: current.transcript,
              start: 0,
              end: Math.max(1, current.duration),
            },
          ];
      const names = current.speakerNames || {};
      const captions = segments
        .map((segment, index) => {
          const speaker = names[segment.speaker]?.trim() || segment.speaker;
          const timing = `${captionTime(segment.start, format === "srt" ? "," : ".")} --> ${captionTime(Math.max(segment.end, segment.start + 0.25), format === "srt" ? "," : ".")}`;
          return `${format === "srt" ? `${index + 1}\n` : ""}${timing}\n${speaker}: ${segment.text.trim()}`;
        })
        .join("\n\n");
      downloadFile(
        `${base}.${format}`,
        `${format === "vtt" ? "WEBVTT\n\n" : ""}${captions}\n`,
        format === "vtt" ? "text/vtt" : "application/x-subrip",
      );
    }
    if (format === "txt") downloadFile(base + ".txt", text);
    if (format === "md")
      downloadFile(
        base + ".md",
        `# ${current.title}\n\n**Date:** ${new Date(current.date).toLocaleString()}  \n**Type:** ${current.meetingType || "general"}  \n**Attendees:** ${current.attendees || "Not listed"}\n\n## Summary\n${current.summary}${section("Key points", current.keyPoints)}${section("Decisions", current.decisions)}${section("Action items", current.actions)}\n\n## Transcript\n${current.transcript}`,
        "text/markdown",
      );
    if (format === "json")
      downloadFile(
        base + ".json",
        JSON.stringify(current, null, 2),
        "application/json",
      );
    if (format === "csv") {
      const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
      const rows = [
        "Task,Owner,Due,Priority,Completed",
        ...current.actions.map((task, i) =>
          [
            task,
            current.actionDetails?.[i]?.owner || "",
            current.actionDetails?.[i]?.due || "",
            current.actionDetails?.[i]?.priority || "",
            current.completed?.[i] ? "Yes" : "No",
          ]
            .map((v) => esc(String(v)))
            .join(","),
        ),
      ];
      downloadFile(base + "-actions.csv", rows.join("\n"), "text/csv");
    }
    if (format === "ics") {
      const start = new Date(current.date),
        end = new Date(
          start.getTime() + Math.max(current.duration, 1800) * 1000,
        ),
        icsDate = (d: Date) =>
          d
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, "");
      const clean = (s: string) =>
        s
          .replace(/\\/g, "\\\\")
          .replace(/\n/g, "\\n")
          .replace(/,/g, "\\,")
          .replace(/;/g, "\\;");
      const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Said and Done//EN\r\nBEGIN:VEVENT\r\nUID:${current.id}@meeting-notes\r\nDTSTAMP:${icsDate(new Date())}\r\nDTSTART:${icsDate(start)}\r\nDTEND:${icsDate(end)}\r\nSUMMARY:${clean(current.title)}\r\nDESCRIPTION:${clean(current.agenda || current.summary || "Meeting")}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
      downloadFile(base + ".ics", ics, "text/calendar");
    }
  }
  async function copyNotes() {
    if (!current) return;
    await navigator.clipboard.writeText(
      `${current.title}\n\n${current.summary}\n\nAction items:\n${current.actions.map((x) => "• " + x).join("\n")}`,
    );
    notify("Notes copied");
  }
  function printMeeting() {
    window.print();
  }
  async function draftFollowup() {
    if (!current) return;
    try {
      setProcessing("Drafting follow-up email…");
      setError("");
      const response = await fetch(`${API_BASE}/api/followup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: current.title,
          attendees: current.attendees,
          summary: current.summary,
          actions: current.actions,
          decisions: current.decisions,
          openQuestions: current.openQuestions,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Follow-up draft failed");
      update({ followupEmail: data.email });
    } catch (e) {
      const actions = current.actions.length
        ? "\n\nAction items:\n" +
          current.actions
            .map(
              (x, i) =>
                "• " +
                x +
                (current.actionDetails?.[i]?.owner
                  ? " (" + current.actionDetails[i].owner + ")"
                  : ""),
            )
            .join("\n")
        : "";
      const decisions = current.decisions?.length
        ? "\n\nDecisions:\n" + current.decisions.map((x) => "• " + x).join("\n")
        : "";
      update({
        followupEmail:
          "Subject: " +
          current.title +
          " follow-up\n\nHi everyone,\n\nHere is a recap of " +
          current.title +
          ".\n\n" +
          current.summary +
          decisions +
          actions +
          "\n\nPlease reply with any corrections or questions.\n\nBest,",
      });
      setError(
        (e instanceof Error ? e.message : "AI drafting is unavailable") +
          " A basic local draft was created.",
      );
    } finally {
      setProcessing("");
    }
  }
  const view = current ? transcriptionView(current) : null;
  const busyTranscribing =
    !!current &&
    ["uploading", "queued", "processing", "retrying"].includes(
      current.transcriptionState || "",
    );
  const realTranscript = !!current && hasRealTranscript(current.transcript);
  const summaryPlaceholder =
    !current?.summary ||
    /will appear after transcription|creating ai meeting notes|transcription is in progress|recovered from continuous local checkpoints|recording recovered|no transcript is available yet|could not be transcribed/i.test(
      current.summary,
    );
  const showRecorder = mobileView === "record" || recording;
  const speakers = current?.transcriptSegments?.length
    ? [...new Set(current.transcriptSegments.map((s) => s.speaker))]
    : [];
  const openTasks = current
    ? current.actions.filter((_, i) => !current.completed?.[i]).length
    : 0;
  function setActionTask(i: number, task: string) {
    if (!current) return;
    const actions = [...current.actions];
    actions[i] = task;
    const details = current.actions.map((t, n) => ({
      ...({ task: t, owner: null, due: null, priority: "medium" } as ActionItem),
      ...(current.actionDetails?.[n] || {}),
      task: n === i ? task : t,
    }));
    update({ actions, actionDetails: details });
  }
  function toggleMeetingAction(meetingId: string, index: number) {
    setMeetings((items) =>
      items.map((m) => {
        if (m.id !== meetingId) return m;
        const completed = [...(m.completed || [])];
        completed[index] = !completed[index];
        return { ...m, completed, updatedAt: new Date().toISOString() };
      }),
    );
    notify("Task completed");
  }
  function recordPlanned() {
    setConsent(false);
    setElapsed(0);
    setLive("");
    setError("");
    setMobileView("record");
  }
  function openRecorder() {
    startMobileMeeting();
    setShowDashboard(false);
    setLibraryOpen(false);
  }
  const exportMenu = (
    <details className="menu">
      <summary className="icon-button" aria-label="Export and more">
        <MoreHorizontal />
      </summary>
      <div
        className="menu-pop"
        role="menu"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button"))
            (e.currentTarget.parentElement as HTMLDetailsElement).open = false;
        }}
      >
        <button onClick={() => void copyNotes()}>
          <Copy /> Copy notes
        </button>
        <button onClick={() => exportMeeting("md")}>
          <FileText /> Markdown
        </button>
        <button onClick={() => exportMeeting("txt")}>
          <FileText /> Plain text
        </button>
        <button onClick={() => exportMeeting("csv")}>
          <ListChecks /> Action items (CSV)
        </button>
        <button onClick={() => exportMeeting("srt")}>
          <Clock /> Captions (SRT)
        </button>
        <button onClick={() => exportMeeting("vtt")}>
          <Clock /> Captions (VTT)
        </button>
        <button onClick={() => exportMeeting("ics")}>
          <CalendarPlus /> Calendar event
        </button>
        <button onClick={() => exportMeeting("json")}>
          <Download /> JSON backup
        </button>
        <button onClick={printMeeting}>
          <Printer /> Print or PDF
        </button>
        <hr />
        {current?.archived ? (
          <>
            <button onClick={restoreMeeting}>
              <RotateCcw /> Restore meeting
            </button>
            <button className="danger" onClick={deleteForever}>
              <Trash2 /> Delete forever
            </button>
          </>
        ) : current?.status === "planned" ? (
          <button className="danger" onClick={deleteForever}>
            <Trash2 /> Delete meeting
          </button>
        ) : (
          <button className="danger" onClick={archiveMeeting}>
            <Archive /> Archive meeting
          </button>
        )}
      </div>
    </details>
  );
  return (
    <main className={`app view-${showRecorder ? "record" : mobileView}`}>
      {libraryOpen && (
        <button
          className="library-backdrop"
          aria-label="Close meeting library"
          onClick={() => setLibraryOpen(false)}
        />
      )}
      <aside className={`sidebar ${libraryOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <img src="/saiddone-mark.png" alt="" />
          <div>
            <b>Said and Done</b>
            <small>From conversation to completion</small>
          </div>
        </div>
        <button className="btn btn-record btn-block" onClick={openRecorder} disabled={recording && !showRecorder}>
          <Mic /> {recording ? "Recording…" : "Record"}
        </button>
        <div className="sidebar-row">
          <button
            className="btn btn-secondary"
            onClick={() => {
              newMeeting();
              setMobileView("detail");
              setLibraryOpen(false);
            }}
          >
            <CalendarPlus /> Schedule
          </button>
          <label className="btn btn-secondary">
            <Upload /> Import
            <input type="file" accept="audio/*,video/*" onChange={(e) => void upload(e)} />
          </label>
        </div>
        <div className="search-field">
          <Search />
          <input
            type="search"
            aria-label="Search meetings"
            placeholder="Search meetings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sidebar-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={!showArchived && !showDashboard}
            className={!showArchived && !showDashboard ? "active" : ""}
            onClick={() => {
              setShowArchived(false);
              setShowDashboard(false);
            }}
          >
            Meetings
          </button>
          <button
            role="tab"
            aria-selected={showDashboard}
            className={showDashboard ? "active" : ""}
            onClick={() => {
              setShowDashboard(true);
              setMobileView("detail");
            }}
          >
            Insights
          </button>
          <button
            role="tab"
            aria-selected={showArchived}
            className={showArchived ? "active" : ""}
            onClick={() => {
              setShowArchived(true);
              setShowDashboard(false);
              setFolderFilter("all");
            }}
          >
            Archive
          </button>
        </div>
        {folders.length > 0 && (
          <label className="folder-filter">
            <Folder />
            <select
              aria-label="Filter by folder"
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
            >
              <option value="all">All folders</option>
              <option value="Unfiled">Unfiled</option>
              {folders.map((folder) => (
                <option key={folder}>{folder}</option>
              ))}
            </select>
          </label>
        )}
        <div className="meeting-list">
          {filtered.length ? (
            filtered.map((m) => {
              const v = transcriptionView(m);
              return (
                <button
                  className={m.id === current?.id && !showRecorder && !showDashboard ? "active" : ""}
                  onClick={() => {
                    setSelected(m.id);
                    setShowDashboard(false);
                    setLibraryOpen(false);
                    setMobileView("detail");
                  }}
                  key={m.id}
                >
                  <span className="list-title">
                    {m.favorite && <Star className="fav" />}
                    {m.title}
                  </span>
                  <small>
                    {m.status === "planned" && <em className="pill-planned">Planned</em>}
                    {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {m.duration ? ` · ${humanDuration(m.duration)}` : ""}
                    {v && <i className={`dot dot-${v.tone}`} title={v.label} />}
                  </small>
                </button>
              );
            })
          ) : (
            <p className="empty-inline">
              No {showArchived ? "archived " : ""}meetings found.
            </p>
          )}
        </div>
        <button
          className="settings-entry"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings />
          <span>
            <b>Settings</b>
            <small>
              {session ? session.user.email || "Cloud sync on" : "Stored on this device"}
            </small>
          </span>
        </button>
      </aside>
      {mobileView === "home" && !showRecorder && (
        <MobileHome
          meetings={meetings}
          query={query}
          tab={mobileTab}
          onQuery={setQuery}
          onTab={setMobileTab}
          onOpenMeeting={openMobileMeeting}
          onRecord={startMobileMeeting}
          onSchedule={scheduleMobileMeeting}
          onSettings={() => setSettingsOpen(true)}
          onImport={(e) => void upload(e)}
          onToggleAction={toggleMeetingAction}
          signedIn={!!session}
        />
      )}
      <section className="workspace">
        {showRecorder ? (
          <section className="record-stage">
            <div className="record-top">
              {!recording ? (
                <button className="link-button" onClick={leaveMobileRecorder}>
                  <ChevronLeft /> Back
                </button>
              ) : (
                <span className="rec-indicator">
                  <i /> {paused ? "Paused" : "Recording"}
                </span>
              )}
            </div>
            <div className="record-center">
              {current?.status === "planned" && (
                <p className="record-for">Recording for “{current.title}”</p>
              )}
              <div className={`record-rings ${recording && !paused ? "live" : ""} ${paused ? "paused" : ""}`}>
                <span className="record-core">
                  <Mic />
                </span>
              </div>
              <div className="record-timer" aria-live="off">
                {fmt(elapsed)}
              </div>
              <p className="record-state">
                {!recording
                  ? "Ready when you are"
                  : paused
                    ? "Recording paused"
                    : "Listening — audio saves every few seconds"}
              </p>
            </div>
            {!recording ? (
              <div className="record-setup">
                <label className="consent-card">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span className="check-ui" aria-hidden="true">
                    <Check />
                  </span>
                  <span>
                    <b>Everyone agreed to be recorded</b>
                    <small>Required before you start.</small>
                  </span>
                </label>
                <button
                  className="btn btn-record btn-xl"
                  onClick={() => void start()}
                  disabled={!consent}
                >
                  <Mic /> Start recording
                </button>
                <label className="btn btn-ghost">
                  <Upload /> Or import an audio file
                  <input type="file" accept="audio/*,video/*" onChange={(e) => void upload(e)} />
                </label>
              </div>
            ) : (
              <div className="record-controls">
                <button className="btn btn-secondary btn-xl" onClick={pauseRecording}>
                  {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
                </button>
                <button className="btn btn-stop btn-xl" onClick={stop}>
                  <Square /> Stop
                </button>
              </div>
            )}
            {recording && live && (
              <div className="live-card">
                <span className="eyebrow">Live transcript</span>
                <p>{live}</p>
              </div>
            )}
            <p className="record-tip">
              {recording
                ? "Keep this screen open. When you stop, the recording is transcribed and summarized automatically."
                : "Your audio stays on this device and is saved continuously, so nothing is lost if the app closes."}
            </p>
          </section>
        ) : showDashboard ? (
          <section className="insights-view">
            <div className="mobile-appbar">
              <button className="link-button" onClick={() => { setShowDashboard(false); setMobileView("home"); }}>
                <ChevronLeft /> Back
              </button>
            </div>
            <h1 className="page-title">Insights</h1>
            <div className="stat-grid">
              <div className="stat"><b>{stats.meetings}</b><span>Meetings</span></div>
              <div className="stat"><b>{stats.minutes.toLocaleString()}</b><span>Minutes recorded</span></div>
              <div className="stat"><b>{stats.words.toLocaleString()}</b><span>Words transcribed</span></div>
              <div className="stat"><b>{stats.open}</b><span>Open tasks</span></div>
              <div className="stat"><b>{stats.done}</b><span>Tasks done</span></div>
            </div>
          </section>
        ) : current ? (
          <>
            <div className="mobile-appbar">
              <button
                className="link-button"
                onClick={() => setMobileView("home")}
              >
                <ChevronLeft /> Back
              </button>
              <div className="appbar-actions">
                <button
                  className="icon-button"
                  aria-label="Share"
                  onClick={() => void shareMeeting()}
                >
                  <Share2 />
                </button>
                {exportMenu}
              </div>
            </div>
            <header className="detail-header">
              <div className="title-row">
                <input
                  className="title-input"
                  aria-label="Meeting title"
                  value={current.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
                <button
                  className={current.favorite ? "star active" : "star"}
                  aria-label={current.favorite ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={!!current.favorite}
                  onClick={() => update({ favorite: !current.favorite })}
                >
                  <Star />
                </button>
              </div>
              <div className="meta-row">
                <span>
                  <CalendarDays />
                  {new Date(current.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {timeLabel(current.date)}
                </span>
                {current.duration > 0 && (
                  <span>
                    <Clock3 /> {humanDuration(current.duration)}
                  </span>
                )}
                {current.status === "planned" && <span className="badge badge-busy">Planned</span>}
                {current.archived && <span className="badge">Archived</span>}
                <StatusBadge view={view} />
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => void shareMeeting()}>
                  <Share2 /> Share
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => void copyNotes()}>
                  <Copy /> Copy
                </button>
                {exportMenu}
              </div>
            </header>
            {current.status === "planned" && !current.localRecordingId && (
              <section className="card prep-card">
                <div className="card-head">
                  <CalendarDays />
                  <h2>Prepare</h2>
                </div>
                <div className="field-grid">
                  <label className="field">
                    <span>Date and time</span>
                    <input
                      type="datetime-local"
                      value={localDateTime(current.date)}
                      onChange={(e) =>
                        e.target.value &&
                        update({ date: new Date(e.target.value).toISOString() })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Attendees</span>
                    <input
                      value={current.attendees || ""}
                      placeholder="Names or emails"
                      onChange={(e) => update({ attendees: e.target.value })}
                    />
                  </label>
                  <label className="field wide">
                    <span>Agenda</span>
                    <AutoTextarea
                      value={current.agenda || ""}
                      placeholder="What should this meeting cover?"
                      onChange={(value) => update({ agenda: value })}
                    />
                  </label>
                </div>
                <button className="btn btn-record btn-block" onClick={recordPlanned} disabled={recording}>
                  <Mic /> Record this meeting
                </button>
              </section>
            )}
            {(current.audio || current.localRecordingId) && (
              <section className={`card audio-card ${view?.tone === "warn" ? "needs-attention" : ""}`}>
                <div className="audio-row">
                  <button
                    className="play-button"
                    disabled={!current.audio}
                    aria-label={playing ? "Pause recording" : "Play recording"}
                    onClick={() => {
                      const el = audioPlayer.current;
                      if (!el) return;
                      if (playing) el.pause();
                      else void el.play();
                    }}
                  >
                    {playing ? <Pause /> : <Play />}
                  </button>
                  <audio
                    ref={audioPlayer}
                    src={current.audio}
                    preload="metadata"
                    onPlay={(e) => {
                      e.currentTarget.playbackRate = playbackRate;
                      setPlaying(true);
                    }}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                  />
                  <div className="audio-info">
                    <b>Recording</b>
                    <span>
                      {view
                        ? view.label +
                          (current.transcriptionTotalParts && view.tone !== "ok"
                            ? ` · ${current.transcriptionCompletedParts || 0} of ${current.transcriptionTotalParts} parts`
                            : "")
                        : current.recordingBackupStatus === "cloud"
                          ? "Backed up to the cloud"
                          : current.recordingBackupStatus === "uploading"
                            ? "Backing up…"
                            : current.recordingBackupStatus === "failed"
                              ? "Saved on this device · cloud backup failed"
                              : "Saved on this device"}
                    </span>
                  </div>
                  <select
                    className="speed"
                    aria-label="Playback speed"
                    value={playbackRate}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      setPlaybackRate(rate);
                      if (audioPlayer.current) audioPlayer.current.playbackRate = rate;
                    }}
                  >
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}×
                      </option>
                    ))}
                  </select>
                </div>
                <div className="scrub">
                  <input
                    type="range"
                    aria-label="Seek"
                    min={0}
                    max={Math.max(1, current.duration)}
                    step={1}
                    value={Math.min(playbackTime, Math.max(1, current.duration))}
                    style={{ ["--pct" as any]: `${(Math.min(playbackTime, current.duration || 1) / Math.max(1, current.duration)) * 100}%` }}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setPlaybackTime(t);
                      if (audioPlayer.current) audioPlayer.current.currentTime = t;
                    }}
                  />
                  <span>
                    {fmt(playbackTime)} <i>/</i> {fmt(current.duration)}
                  </span>
                </div>
                {view?.tone === "busy" && (
                  <div className="progress" aria-hidden="true">
                    <i style={{ width: `${Math.max(4, Math.round((view.progress || 0) * 100))}%` }} />
                  </div>
                )}
                {current.transcriptionError && (
                  <p className="audio-error">
                    <CircleAlert /> {current.transcriptionError}
                  </p>
                )}
                {current.localRecordingId && (
                  <button
                    className={`btn btn-block ${view?.tone === "warn" ? "btn-primary" : "btn-secondary"}`}
                    onClick={retryTranscription}
                    disabled={!!processing || busyTranscribing}
                  >
                    {busyTranscribing || processing.startsWith("Preparing") || processing.startsWith("Transcribing") || processing.startsWith("Resuming") || processing.startsWith("Uploading") ? (
                      <>
                        <Loader2 className="spin" /> Transcribing…
                      </>
                    ) : current.transcriptionState === "partial" ? (
                      <>
                        <Play /> Resume transcription
                      </>
                    ) : realTranscript ? (
                      <>
                        <RotateCcw /> Transcribe again
                      </>
                    ) : current.transcriptionState === "failed" ? (
                      <>
                        <RotateCcw /> Retry transcription
                      </>
                    ) : (
                      <>
                        <AudioLines /> Transcribe recording
                      </>
                    )}
                  </button>
                )}
              </section>
            )}
            <div className="detail-grid">
              <div className="detail-main">
                <section className="card o-1">
                  <div className="card-head">
                    <Sparkles />
                    <h2>Summary</h2>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void regenerate()}
                      disabled={!!processing || !realTranscript}
                      title={realTranscript ? "Generate with AI" : "Transcribe first"}
                    >
                      {summaryPlaceholder ? "Generate" : "Regenerate"}
                    </button>
                  </div>
                  {summaryPlaceholder && !realTranscript ? (
                    <p className="empty-text">
                      {busyTranscribing
                        ? "Your summary will appear once transcription finishes."
                        : current.localRecordingId
                          ? "Transcribe the recording to get a summary, key points, and action items."
                          : current.status === "planned"
                            ? "Record this meeting to get a summary."
                            : "Add a transcript below, then generate a summary."}
                    </p>
                  ) : (
                    <AutoTextarea
                      className="prose-input"
                      ariaLabel="Meeting summary"
                      value={summaryPlaceholder ? "" : current.summary}
                      placeholder="Write or generate a summary"
                      onChange={(value) => update({ summary: value })}
                    />
                  )}
                </section>
                {((current.keyPoints?.length || 0) > 0 || (current.decisions?.length || 0) > 0) && (
                  <section className="card o-3">
                    {(current.keyPoints?.length || 0) > 0 && (
                      <>
                        <div className="card-head">
                          <FileText />
                          <h2>Key points</h2>
                        </div>
                        <ul className="bullets">
                          {current.keyPoints!.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {(current.decisions?.length || 0) > 0 && (
                      <>
                        <div className="card-head">
                          <CheckCircle2 />
                          <h2>Decisions</h2>
                        </div>
                        <ul className="bullets decisions">
                          {current.decisions!.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                )}
                {((current.openQuestions?.length || 0) > 0 ||
                  (current.risks?.length || 0) > 0 ||
                  (current.followUp?.length || 0) > 0) && (
                  <section className="card o-4">
                    {(
                      [
                        [current.openQuestions, "Open questions", Search],
                        [current.risks, "Risks", ShieldCheck],
                        [current.followUp, "For next time", Clock],
                      ] as const
                    )
                      .filter(([list]) => (list?.length || 0) > 0)
                      .map(([list, title, Icon]) => (
                        <div key={title}>
                          <div className="card-head">
                            <Icon />
                            <h2>{title}</h2>
                          </div>
                          <ul className="bullets">
                            {list!.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </section>
                )}
                {realTranscript && (
                  <section className="card o-5">
                    <div className="card-head">
                      <MessageSquareText />
                      <h2>Ask this meeting</h2>
                    </div>
                    <form
                      className="ask-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void ask();
                      }}
                    >
                      <input
                        placeholder="What was decided? Who owns what?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={!question.trim() || !!processing}
                      >
                        Ask
                      </button>
                    </form>
                    {answer && <p className="answer">{answer}</p>}
                  </section>
                )}
                <section className="card transcript-card o-6">
                  <div className="card-head">
                    <AudioLines />
                    <h2>Transcript</h2>
                    {realTranscript && (
                      <span className="muted-note">
                        {current.transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                      </span>
                    )}
                  </div>
                  {speakers.length > 0 && (
                    <>
                      <details className="speaker-names">
                        <summary>
                          <Users /> Name the {speakers.length} speaker{speakers.length === 1 ? "" : "s"}
                        </summary>
                        <div className="field-grid">
                          {speakers.map((speaker) => (
                            <label className="field" key={speaker}>
                              <span>{speaker.replace(/_/g, " ")}</span>
                              <input
                                aria-label={"Rename " + speaker}
                                value={current.speakerNames?.[speaker] || ""}
                                placeholder="Name"
                                onChange={(e) => renameSpeaker(speaker, e.target.value)}
                              />
                            </label>
                          ))}
                        </div>
                      </details>
                      <div className="segments">
                        {current.transcriptSegments!.map((segment, i) => {
                          const idx = speakers.indexOf(segment.speaker) % 6;
                          return (
                            <button
                              type="button"
                              className={`segment spk-${idx} ${playbackTime >= segment.start && playbackTime < segment.end ? "active" : ""}`}
                              key={i}
                              disabled={!current.audio}
                              title={current.audio ? `Play from ${fmt(Math.round(segment.start))}` : undefined}
                              onClick={() => {
                                const player = audioPlayer.current;
                                if (!player) return;
                                player.currentTime = segment.start;
                                void player.play();
                              }}
                            >
                              <span className="segment-head">
                                <b>
                                  {current.speakerNames?.[segment.speaker]?.trim() ||
                                    segment.speaker.replace(/_/g, " ")}
                                </b>
                                <time>{fmt(Math.round(segment.start))}</time>
                              </span>
                              <p>{segment.text}</p>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <details className="raw-transcript" open={speakers.length === 0}>
                    <summary>{speakers.length ? "Edit full transcript" : "Transcript text"}</summary>
                    <AutoTextarea
                      className="mono-input"
                      ariaLabel="Meeting transcript"
                      value={realTranscript ? current.transcript : ""}
                      placeholder={
                        current.localRecordingId
                          ? "The transcript will appear here after transcription."
                          : "Paste or type a transcript"
                      }
                      onChange={(value) => update({ transcript: value })}
                    />
                  </details>
                </section>
              </div>
              <div className="detail-side">
                <section className="card o-2">
                  <div className="card-head">
                    <ListChecks />
                    <h2>Action items</h2>
                    {current.actions.length > 0 && (
                      <span className="muted-note">
                        {openTasks} open
                      </span>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={addAction}>
                      <Plus /> Add
                    </button>
                  </div>
                  {current.actions.length ? (
                    <div className="action-list">
                      {current.actions.map((a, i) => {
                        const d = current.actionDetails?.[i];
                        const done = !!current.completed?.[i];
                        return (
                          <div className={`action-row ${done ? "done" : ""}`} key={i}>
                            <button
                              className={`task-check ${done ? "checked" : ""}`}
                              aria-label={(done ? "Mark not done: " : "Mark done: ") + a}
                              aria-pressed={done}
                              onClick={() => toggleAction(i)}
                            >
                              {done && <Check />}
                            </button>
                            <div className="action-main">
                              <AutoTextarea
                                className="action-input"
                                ariaLabel="Action item"
                                value={a}
                                onChange={(value) => setActionTask(i, value.replace(/\n/g, " "))}
                              />
                              <div className="action-chips">
                                <label className="chip-field">
                                  <Users />
                                  <input
                                    aria-label="Owner"
                                    value={d?.owner || ""}
                                    placeholder="Owner"
                                    onChange={(e) => updateActionDetail(i, { owner: e.target.value || null })}
                                  />
                                </label>
                                <label className={`chip-field ${isOverdue(d?.due) && !done ? "overdue" : ""}`}>
                                  <Clock3 />
                                  {d?.due && !isIsoDate(d.due) ? (
                                    <input
                                      aria-label="Due"
                                      value={d.due}
                                      onChange={(e) => updateActionDetail(i, { due: e.target.value || null })}
                                    />
                                  ) : (
                                    <input
                                      aria-label="Due date"
                                      type="date"
                                      value={d?.due || ""}
                                      onChange={(e) => updateActionDetail(i, { due: e.target.value || null })}
                                    />
                                  )}
                                </label>
                                <select
                                  aria-label="Priority"
                                  className={`chip-select pri-${d?.priority || "medium"}`}
                                  value={d?.priority || "medium"}
                                  onChange={(e) =>
                                    updateActionDetail(i, {
                                      priority: e.target.value as "low" | "medium" | "high",
                                    })
                                  }
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </div>
                            </div>
                            <button
                              className="icon-button subtle"
                              aria-label="Remove action item"
                              onClick={() => removeAction(i)}
                            >
                              <X />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-text">No action items yet.</p>
                  )}
                </section>
                <section className="card o-8">
                  <div className="card-head">
                    <Tag />
                    <h2>Tags</h2>
                  </div>
                  {[...(current.topics || []), ...(current.tags || [])].length > 0 && (
                    <div className="tag-list">
                      {[...(current.topics || []), ...(current.tags || [])]
                        .filter(
                          (x, i, a) =>
                            a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i,
                        )
                        .map((x) => (
                          <span className="tag" key={x}>
                            #{x}
                            {current.tags?.includes(x) && (
                              <button
                                aria-label={"Remove " + x}
                                onClick={() =>
                                  update({ tags: current.tags?.filter((t) => t !== x) })
                                }
                              >
                                <X />
                              </button>
                            )}
                          </span>
                        ))}
                    </div>
                  )}
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("tag") as HTMLInputElement;
                      addTag(input.value);
                      input.value = "";
                    }}
                  >
                    <input name="tag" placeholder="Add a tag" aria-label="Add a tag" />
                    <button className="btn btn-secondary btn-sm">Add</button>
                  </form>
                </section>
                {realTranscript && (
                  <section className="card o-7">
                    <div className="card-head">
                      <Mail />
                      <h2>Follow-up email</h2>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void draftFollowup()}
                        disabled={summaryPlaceholder || !!processing}
                      >
                        {current.followupEmail ? "Redraft" : "Draft"}
                      </button>
                    </div>
                    {current.followupEmail ? (
                      <>
                        <AutoTextarea
                          className="prose-input"
                          ariaLabel="Follow-up email draft"
                          value={current.followupEmail}
                          onChange={(value) => update({ followupEmail: value })}
                        />
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(current.followupEmail || "")
                              .then(() => notify("Email copied"))
                          }
                        >
                          <Copy /> Copy email
                        </button>
                      </>
                    ) : (
                      <p className="empty-text">
                        Turn the summary, decisions, and action items into a ready-to-send recap.
                      </p>
                    )}
                  </section>
                )}
                <details className="card details-card o-9" open={current.status === "planned" && !!current.localRecordingId}>
                  <summary className="card-head">
                    <Info />
                    <h2>Details</h2>
                    <ChevronDown className="disclose" />
                  </summary>
                  <div className="field-grid">
                    <label className="field">
                      <span>Meeting type</span>
                      <select
                        value={current.meetingType || "general"}
                        onChange={(e) => update({ meetingType: e.target.value })}
                      >
                        <option value="general">General</option>
                        <option value="one-on-one">1:1</option>
                        <option value="project">Project update</option>
                        <option value="client">Client meeting</option>
                        <option value="interview">Interview</option>
                        <option value="brainstorm">Brainstorm</option>
                        <option value="training">Training</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Language</span>
                      <select
                        value={current.language || language}
                        onChange={(e) => {
                          setLanguage(e.target.value);
                          update({ language: e.target.value });
                        }}
                      >
                        <option value="auto">Auto detect</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="pt">Portuguese</option>
                        <option value="it">Italian</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                        <option value="zh">Chinese</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select
                        value={current.status || "complete"}
                        onChange={(e) => update({ status: e.target.value as "planned" | "complete" })}
                      >
                        <option value="planned">Planned</option>
                        <option value="complete">Complete</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Folder</span>
                      <input
                        value={current.folder || ""}
                        placeholder="e.g. Clients"
                        list="meeting-folders"
                        onChange={(e) => update({ folder: e.target.value })}
                      />
                      <datalist id="meeting-folders">
                        {folders.map((folder) => (
                          <option key={folder} value={folder} />
                        ))}
                      </datalist>
                    </label>
                    {!(current.status === "planned" && !current.localRecordingId) && (
                      <>
                        <label className="field wide">
                          <span>Date and time</span>
                          <input
                            type="datetime-local"
                            value={localDateTime(current.date)}
                            onChange={(e) =>
                              e.target.value &&
                              update({ date: new Date(e.target.value).toISOString() })
                            }
                          />
                        </label>
                        <label className="field wide">
                          <span>Attendees</span>
                          <input
                            value={current.attendees || ""}
                            placeholder="Names or emails"
                            onChange={(e) => update({ attendees: e.target.value })}
                          />
                        </label>
                        <label className="field wide">
                          <span>Agenda</span>
                          <AutoTextarea
                            value={current.agenda || ""}
                            placeholder="What this meeting covered"
                            onChange={(value) => update({ agenda: value })}
                          />
                        </label>
                      </>
                    )}
                    <label className="field wide">
                      <span>Custom vocabulary</span>
                      <AutoTextarea
                        value={current.customVocabulary || ""}
                        placeholder="Names, acronyms, product terms — comma separated"
                        onChange={(value) => update({ customVocabulary: value.slice(0, 1000) })}
                      />
                      <small>Helps spell names correctly in the next transcription.</small>
                    </label>
                    <label className="field wide">
                      <span>Private notes</span>
                      <AutoTextarea
                        value={current.notes || ""}
                        placeholder="Only you see these"
                        onChange={(value) => update({ notes: value })}
                      />
                    </label>
                  </div>
                </details>
              </div>
            </div>
            <footer className="credit">Created by Nikki</footer>
          </>
        ) : (
          <div className="home-empty">
            <span className="empty-icon">
              <AudioLines />
            </span>
            <h2>No meeting selected</h2>
            <p>Record, import, or schedule a meeting to get started.</p>
            <button className="btn btn-record" onClick={openRecorder}>
              <Mic /> Start recording
            </button>
          </div>
        )}
      </section>
      <div className="status-dock" aria-live="polite">
        {processing && (
          <div className="dock-item dock-busy">
            <Loader2 className="spin" />
            <span>{processing}</span>
          </div>
        )}
        {error && (
          <div className="dock-item dock-error" role="alert">
            <CircleAlert />
            <span>{error}</span>
            <button className="icon-button subtle" aria-label="Dismiss" onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        {toast && !error && (
          <div className="dock-item dock-toast">
            <CheckCircle2 />
            <span>{toast}</span>
          </div>
        )}
      </div>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        session={session}
        email={email}
        password={password}
        authMode={authMode}
        cloudStatus={cloudStatus}
        online={online}
        installAvailable={!!installPrompt}
        theme={theme}
        autoSync={autoSync}
        remindersEnabled={remindersEnabled}
        notificationPermission={notificationPermission}
        onEmail={setEmail}
        onPassword={setPassword}
        onAuthMode={() =>
          setAuthMode(authMode === "signin" ? "signup" : "signin")
        }
        onAuthenticate={() => void authenticate()}
        onSync={() => void syncCloud()}
        onSignOut={signOut}
        onBackup={backupLibrary}
        onRestore={(e) => void restoreBackup(e)}
        onInstall={() => void installApp()}
        onTheme={setTheme}
        onAutoSync={setAutoSync}
        onRemindersEnabled={saveReminderPreference}
        onEnableReminders={enableReminders}
        meetingReminderMinutes={meetingReminderMinutes}
        taskReminderTime={taskReminderTime}
        onMeetingReminderMinutes={saveMeetingReminderMinutes}
        onTaskReminderTime={saveTaskReminderTime}
        calendarConnections={calendarConnections}
        calendarStatus={calendarStatus}
        calendarBusy={calendarBusy}
        onConnectCalendar={(provider) => void connectCalendar(provider)}
        onDisconnectCalendar={(provider) => void disconnectCalendar(provider)}
        onSyncCalendars={() => void syncCalendars()}
        calendarHistory={calendarHistory}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

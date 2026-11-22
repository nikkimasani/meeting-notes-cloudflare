import { useSyncExternalStore } from "react";
import { AudioLines, MessageCircle, Settings, Mic } from "lucide-react";
import { recorder } from "../lib/recorder";
import { clock, go, type Route } from "./kit";

export function useRecorder() {
  return useSyncExternalStore(recorder.subscribe, recorder.getSnapshot);
}

export function Rail({ route }: { route: Route }) {
  const rec = useRecorder();
  const live = rec.state !== "idle";
  const item = (name: Route["name"], path: string, label: string, icon: React.ReactNode) => (
    <a
      href={"#/" + path}
      className={`rail-item rail-${name} ${route.name === name || (name === "home" && route.name === "meeting") ? "on" : ""}`}
      aria-current={route.name === name ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        go(path);
      }}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
  return (
    <nav className="rail" aria-label="Main">
      <a
        className="rail-brand"
        href="#/"
        onClick={(e) => {
          e.preventDefault();
          go("");
        }}
      >
        <img src="/saiddone-mark.png" alt="" />
        <span>
          Said
          <br />
          &amp; Done
        </span>
      </a>
      <button className={`rail-record ${live ? "live" : ""}`} onClick={() => go("record")} aria-label={live ? "Return to recording" : "Record"}>
        {live ? (
          <>
            <i className="rec-dot" />
            <span className="mono">{clock(rec.elapsed)}</span>
          </>
        ) : (
          <>
            <Mic />
            <span>Record</span>
          </>
        )}
      </button>
      {item("home", "", "Meetings", <AudioLines />)}
      {item("ask", "ask", "Ask AI", <MessageCircle />)}
      {item("settings", "settings", "Settings", <Settings />)}
    </nav>
  );
}

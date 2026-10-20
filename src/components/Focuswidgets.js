import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Timer,
  Target,
  CalendarPlus,
  CalendarCheck,
  CheckCircle,
  Circle,
} from "lucide-react";
import {
  useFocus,
  ymd,
  hm,
  toMin,
  label,
  fmtClock,
  addDays,
} from "../components/Focuscontext";
import "../styles/Focus.css";

/* ───────────── 1. FocusTimer: lives in the Topbar (pill + dropdown panel) ───────────── */
export function FocusTimer() {
  const f = useFocus();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 8 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      )
        setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!f || !f.user) return null;
  const { mode, left, total, running, target, settings } = f;
  const p = total ? 1 - left / total : 0;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    setOpen((o) => !o);
  };

  return (
    <div className={`fk-pill-wrap fk-${mode}`}>
      <button
        ref={btnRef}
        className={`fk-pill ${running ? "fk-run" : ""}`}
        style={{ "--p": p }}
        onClick={toggle}
        aria-expanded={open}
        aria-label="Focus timer"
      >
        <Timer size={15} />
        <span className="fk-pill-time">{fmtClock(left)}</span>
        {running && (
          <span className="fk-pill-label">
            {mode === "focus" ? target?.title || "Focus" : "Break"}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={`fk-tpanel fk-${mode}`}
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="fk-tp-head">
              <span className="fk-tp-phase">
                {mode === "focus" ? "Focus" : "Break"}
              </span>
              <span className="fk-tp-target">
                {mode === "focus"
                  ? target?.title || "No task selected"
                  : "Step away from the screen"}
              </span>
            </div>
            <div className="fk-tp-clock">{fmtClock(left)}</div>
            <div className="fk-tp-bar">
              <i style={{ width: `${p * 100}%` }} />
            </div>
            <div className="fk-row">
              <button
                className="fk-btn fk-primary"
                onClick={running ? f.pause : f.start}
              >
                {running ? (
                  <>
                    <Pause size={13} /> Pause
                  </>
                ) : (
                  <>
                    <Play size={13} /> {left < total ? "Resume" : "Start"}
                  </>
                )}
              </button>
              <button className="fk-btn" onClick={f.skip}>
                <SkipForward size={13} /> Skip
              </button>
              <button className="fk-btn" onClick={f.reset} aria-label="Reset">
                <RotateCcw size={13} />
              </button>
            </div>
            <div className="fk-dock-stats">
              <div>
                <b>{f.todayCount}</b>
                <span>sessions today</span>
              </div>
              <div>
                <b>{f.todayMins}</b>
                <span>focused min</span>
              </div>
            </div>
            <details className="fk-tp-set">
              <summary>Timer settings</summary>
              {[
                ["focus", "Focus"],
                ["short", "Short break"],
                ["long", "Long break"],
              ].map(([k, name]) => (
                <label key={k}>
                  {name} (min)
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings[k]}
                    onChange={(e) =>
                      f.updateSettings({
                        [k]: Math.min(120, Math.max(1, +e.target.value || 1)),
                      })
                    }
                  />
                </label>
              ))}
            </details>
            <button
              className="fk-link"
              onClick={() => {
                setOpen(false);
                nav("/calendar");
              }}
            >
              Open planner
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* Kept as a harmless no-op so an old <FocusDock /> in App.js doesn't crash. You can delete it there. */
export const FocusDock = () => null;

/* ───────────── 2. StudyBlocks: "what to work on" list for any page ─────────────
   <StudyBlocks types={["assignment"]} />        assignments page
   <StudyBlocks types={["todo"]} />              to-do page
   <StudyBlocks classId={cls.id} />              a single class
   <StudyBlocks />                               everything (dashboard)                    */
export function StudyBlocks({ types, classId, title = "Planned work time" }) {
  const f = useFocus();
  const nav = useNavigate();
  if (!f || !f.user) return null;
  const today = ymd(new Date()),
    tomorrow = ymd(addDays(new Date(), 1)),
    end = ymd(addDays(new Date(), 7));
  const list = f.blocks
    .filter(
      (b) =>
        (!types || types.includes(b.source_type)) &&
        (!classId || b.class_id === classId) &&
        b.date >= today &&
        b.date <= end,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    .slice(0, 6);
  const when = (b) =>
    b.date === today
      ? "Today"
      : b.date === tomorrow
        ? "Tomorrow"
        : new Date(b.date + "T00:00").toLocaleDateString("en-US", {
            weekday: "short",
          });

  return (
    <div className="fk-widget">
      <div className="fk-widget-head">
        <span>{title}</span>
        <button className="fk-link" onClick={() => nav("/calendar")}>
          Open calendar
        </button>
      </div>
      {list.length === 0 ? (
        <p className="fk-empty">
          Nothing planned in the next 7 days. Use “Plan time” on an item, or
          drag it onto your calendar.
        </p>
      ) : (
        list.map((b) => {
          const live =
            f.running && f.mode === "focus" && f.target?.blockId === b.id;
          return (
            <div
              key={b.id}
              className={`fk-wrow ${b.done ? "fk-done" : ""}`}
              style={{ "--c": b.color || "#6366f1" }}
            >
              <button
                className="fk-check"
                onClick={() => f.saveBlock({ ...b, done: !b.done })}
                aria-label="Toggle done"
              >
                {b.done ? <CheckCircle size={16} /> : <Circle size={16} />}
              </button>
              <div className="fk-wtext">
                <b>{b.title}</b>
                <small>
                  {when(b)} · {label(b.start)} – {label(b.end)}
                  {b.pomos ? ` · ${b.pomos} done` : ""}
                </small>
              </div>
              <button
                className={`fk-btn ${live ? "fk-live" : ""}`}
                disabled={b.done}
                onClick={() =>
                  f.focusOn({
                    blockId: b.id,
                    title: b.title,
                    source_type: b.source_type,
                    source_id: b.source_id,
                  })
                }
              >
                <Target size={13} /> {live ? "Focusing" : "Focus"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ───────────── 3. ScheduleButton: drop into any row ─────────────
   <ScheduleButton type="assignment" item={a} color={cls?.color} />   */
export function ScheduleButton({ type, item, color }) {
  const f = useFocus();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(ymd(new Date()));
  const [start, setStart] = useState(() => {
    const n = new Date();
    return hm(
      Math.min(
        22 * 60,
        Math.ceil((n.getHours() * 60 + n.getMinutes()) / 30) * 30,
      ),
    );
  });
  const [len, setLen] = useState(60);
  if (!f) return null;
  const mine = f.blocks
    .filter(
      (b) => b.source_id === item.id && !b.done && b.date >= ymd(new Date()),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];

  const save = async (e) => {
    e.preventDefault();
    const s = toMin(start);
    await f.saveBlock({
      title: item.title,
      date,
      start: s,
      end: Math.min(s + len, 1439),
      source_type: type,
      source_id: item.id,
      class_id: item.class_id || "",
      color: color || (type === "todo" ? "#10b981" : "#6366f1"),
      done: false,
      pomos: 0,
    });
    setOpen(false);
  };

  return (
    <>
      <button
        className="btn-icon"
        onClick={() => setOpen(true)}
        title={
          mine
            ? `Planned ${mine.date} ${label(mine.start)}`
            : "Plan time to work on this"
        }
        style={mine ? { color: "#6366f1" } : undefined}
      >
        {mine ? <CalendarCheck size={13} /> : <CalendarPlus size={13} />}
      </button>
      {open &&
        createPortal(
          <div className="fk-overlay" onClick={() => setOpen(false)}>
            <form
              className="fk-modal"
              onClick={(e) => e.stopPropagation()}
              onSubmit={save}
            >
              <h3>Plan time</h3>
              <p className="fk-sub">{item.title}</p>
              <label>
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <div className="fk-two">
                <label>
                  Start
                  <input
                    type="time"
                    step="300"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Length
                  <select value={len} onChange={(e) => setLen(+e.target.value)}>
                    {[25, 30, 45, 60, 90, 120, 180].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="fk-row fk-end">
                <button
                  type="button"
                  className="fk-btn"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button className="fk-btn fk-primary">Add to calendar</button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}

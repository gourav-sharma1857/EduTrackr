import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Target } from "lucide-react";
import {
  useFocus,
  ymd,
  hm,
  toMin,
  label,
  addDays,
} from "../components/Focuscontext";
import "../styles/Focus.css";

const HH = 56,
  SNAP = 15; // px per hour, minutes per snap
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const startOfWeek = (d) => addDays(d, -d.getDay()); // Sunday start, same as your month view
const snapY = (y) =>
  Math.min(1440, Math.max(0, Math.round(((y / HH) * 60) / SNAP) * SNAP));

/**
 * Personal week / day planner for the Calendar tab.
 *  - Your classes appear automatically (from the Classes page: days + start/end time).
 *  - Deadlines (assignments, to-dos, interviews) show as small chips under each day header.
 *  - You add your own study blocks by dragging across any open time.
 * Props come straight from CalenderView: view, date, getEvents(date), classes.
 */
export default function PlannerGrid({ view, date, getEvents, classes = [] }) {
  const f = useFocus();
  const [edit, setEdit] = useState(null);
  const [, setTick] = useState(0);
  const scroller = useRef(null);

  const days = useMemo(
    () =>
      view === "week"
        ? [...Array(7)].map((_, i) => addDays(startOfWeek(date), i))
        : [date],
    [view, date],
  );
  const todayStr = ymd(new Date());

  useEffect(() => {
    const n = new Date();
    if (scroller.current)
      scroller.current.scrollTop = Math.max(
        0,
        ((n.getHours() * 60 + n.getMinutes()) / 60) * HH - 160,
      );
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  if (!f) return null;
  const blocks = f.blocks;

  /* Classes that meet on a given date (weekly repeat, from the Classes page) */
  const classesOn = (d) =>
    classes
      .filter(
        (c) =>
          c.start_time &&
          c.end_time &&
          (c.days || []).includes(DAY_NAMES[d.getDay()]),
      )
      .map((c) => ({ c, start: toMin(c.start_time), end: toMin(c.end_time) }))
      .filter((x) => x.end > x.start);

  const newBlock = (dateStr, start, end) =>
    setEdit({
      title: "",
      date: dateStr,
      start,
      end,
      source_type: "custom",
      source_id: "",
      class_id: "",
      color: "#6366f1",
      done: false,
      pomos: 0,
    });

  /* drag across any open time to create a study block */
  const startDrag = (e, col, ds) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const r = col.getBoundingClientRect();
    const a = snapY(e.clientY - r.top);
    let b = a;
    const g = document.createElement("div");
    g.className = "fk-ghost";
    col.appendChild(g);
    const draw = () => {
      const s = Math.min(a, b),
        en = Math.max(a, b) || s + SNAP;
      g.style.top = (s / 60) * HH + "px";
      g.style.height = ((en - s) / 60) * HH + "px";
      g.textContent = `${label(s)} – ${label(en)}`;
    };
    draw();
    col.setPointerCapture(e.pointerId);
    col.onpointermove = (m) => {
      b = snapY(m.clientY - r.top);
      draw();
    };
    col.onpointerup = () => {
      col.onpointermove = col.onpointerup = null;
      g.remove();
      let s = Math.min(a, b),
        en = Math.max(a, b);
      if (en - s < SNAP) {
        s = Math.min(a, 23 * 60);
        en = s + 60;
      }
      newBlock(ds, s, Math.min(en, 1439));
    };
  };

  const layout = (list) => {
    const lanes = [];
    const out = list.map((b) => {
      let i = lanes.findIndex((end) => end <= b.start);
      if (i < 0) i = lanes.length;
      lanes[i] = b.end;
      return { b, lane: i };
    });
    return { out, n: Math.max(1, lanes.length) };
  };

  return (
    <div className="fk-planner">
      <p className="fk-hint">
        Your classes show up automatically from the Classes page. Drag across
        any open time to add a study block.
      </p>

      <div className="fk-cal">
        <div className="fk-scroller" ref={scroller}>
          <div className="fk-head" style={{ "--n": days.length }}>
            <div />
            {days.map((d) => {
              const ds = ymd(d),
                dl = getEvents(d);
              return (
                <div key={ds} className={ds === todayStr ? "fk-today" : ""}>
                  <span>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <b>{d.getDate()}</b>
                  {dl.slice(0, 3).map((e) => (
                    <i
                      key={e.id}
                      className="fk-chip"
                      title={`${e.title} (due ${e.time})`}
                      style={{ "--c": e.color }}
                    >
                      {e.title}
                    </i>
                  ))}
                  {dl.length > 3 && (
                    <i className="fk-chip fk-more">+{dl.length - 3} more due</i>
                  )}
                </div>
              );
            })}
          </div>

          <div className="fk-body" style={{ "--n": days.length }}>
            <div className="fk-gut">
              {[...Array(23)].map((_, i) => (
                <span key={i} style={{ top: (i + 1) * HH }}>
                  {label((i + 1) * 60)}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const ds = ymd(d);
              const { out, n } = layout(
                blocks
                  .filter((b) => b.date === ds)
                  .sort((a, b) => a.start - b.start || b.end - a.end),
              );
              const nowD = new Date();
              return (
                <div
                  key={ds}
                  className={`fk-col ${ds === todayStr ? "fk-today" : ""}`}
                  onPointerDown={(e) => startDrag(e, e.currentTarget, ds)}
                >
                  {/* fixed class meetings (click-through so you can still drag over them) */}
                  {classesOn(d).map(({ c, start, end }) => (
                    <div
                      key={"c" + c.id}
                      className="fk-class"
                      style={{
                        "--c": c.color || "#3b82f6",
                        top: (start / 60) * HH,
                        height: Math.max(20, ((end - start) / 60) * HH - 2),
                      }}
                    >
                      <b>{c.course_code || c.name}</b>
                      <small>
                        {label(start)} – {label(end)}
                        {c.location ? ` · ${c.location}` : ""}
                      </small>
                    </div>
                  ))}

                  {/* your own study blocks */}
                  {out.map(({ b, lane }) => {
                    const live =
                      f.running &&
                      f.mode === "focus" &&
                      f.target?.blockId === b.id;
                    return (
                      <div
                        key={b.id}
                        className={`fk-ev ${b.done ? "fk-done" : ""} ${live ? "fk-onair" : ""}`}
                        style={{
                          "--c": b.color || "#6366f1",
                          top: (b.start / 60) * HH,
                          height: Math.max(
                            20,
                            ((b.end - b.start) / 60) * HH - 2,
                          ),
                          left: `calc(${(lane * 100) / n}% + 2px)`,
                          width: `calc(${100 / n}% - 4px)`,
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setEdit(b)}
                      >
                        <b>{b.title}</b>
                        <small>
                          {label(b.start)} – {label(b.end)}
                          {b.pomos ? ` · ${b.pomos} done` : ""}
                        </small>
                      </div>
                    );
                  })}
                  {ds === todayStr && (
                    <div
                      className="fk-now"
                      style={{
                        top:
                          ((nowD.getHours() * 60 + nowD.getMinutes()) / 60) *
                          HH,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {edit && (
        <BlockDialog
          block={edit}
          classes={classes}
          onClose={() => setEdit(null)}
          onSave={async (b) => {
            await f.saveBlock(b);
            setEdit(null);
          }}
          onDelete={async () => {
            await f.removeBlock(edit.id);
            setEdit(null);
          }}
          onFocus={async (b) => {
            const id = await f.saveBlock(b);
            f.focusOn({
              blockId: id,
              title: b.title,
              source_type: b.source_type,
              source_id: b.source_id,
            });
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function BlockDialog({ block, classes, onClose, onSave, onDelete, onFocus }) {
  const [t, setT] = useState(block.title);
  const [cls, setCls] = useState(block.class_id || "");
  const [date, setDate] = useState(block.date);
  const [s, setS] = useState(hm(block.start));
  const [e, setE] = useState(hm(block.end));
  const [done, setDone] = useState(!!block.done);
  const [err, setErr] = useState("");

  const build = () => {
    const k = classes.find((x) => x.id === cls);
    const title = t.trim() || (k ? `Study ${k.course_code || k.name}` : "");
    if (!title) {
      setErr("Add a title or pick a class.");
      return null;
    }
    if (toMin(e) <= toMin(s)) {
      setErr("End time must be after the start time.");
      return null;
    }
    return {
      ...block,
      title,
      class_id: cls,
      color: k?.color || block.color || "#6366f1",
      date,
      start: toMin(s),
      end: toMin(e),
      done,
    };
  };

  return createPortal(
    <div className="fk-overlay" onClick={onClose}>
      <form
        className="fk-modal"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={(ev) => {
          ev.preventDefault();
          const b = build();
          if (b) onSave(b);
        }}
      >
        <h3>{block.id ? "Edit study block" : "New study block"}</h3>
        {block.source_type && block.source_type !== "custom" && (
          <p className="fk-sub">Linked to your {block.source_type}</p>
        )}
        <label>
          What are you working on?
          <input
            value={t}
            onChange={(ev) => setT(ev.target.value)}
            maxLength={120}
            autoFocus
            placeholder="e.g. Review chapter 4"
          />
        </label>
        <label>
          For class (optional)
          <select value={cls} onChange={(ev) => setCls(ev.target.value)}>
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code || c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            required
          />
        </label>
        <div className="fk-two">
          <label>
            Start
            <input
              type="time"
              step="300"
              value={s}
              onChange={(ev) => setS(ev.target.value)}
              required
            />
          </label>
          <label>
            End
            <input
              type="time"
              step="300"
              value={e}
              onChange={(ev) => setE(ev.target.value)}
              required
            />
          </label>
        </div>
        <label className="fk-inline">
          <input
            type="checkbox"
            checked={done}
            onChange={(ev) => setDone(ev.target.checked)}
          />{" "}
          Mark block as done
        </label>
        {err && (
          <p className="fk-err" role="alert">
            {err}
          </p>
        )}
        <div className="fk-row">
          {block.id && (
            <button type="button" className="fk-btn" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="fk-grow" />
          <button
            type="button"
            className="fk-btn"
            onClick={() => {
              const b = build();
              if (b) onFocus(b);
            }}
          >
            <Target size={13} /> Focus now
          </button>
          <button type="button" className="fk-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="fk-btn fk-primary">Save</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

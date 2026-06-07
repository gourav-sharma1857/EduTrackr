import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Calendar,
  BookOpen, CheckSquare, Briefcase, Clock
} from "lucide-react";
import "../styles/CalenderView.css";
import "../styles/globals.css";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarView() {
  const navigate = useNavigate();
  const [user, setUser]               = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos]             = useState([]);
  const [classes, setClasses]         = useState([]);
  const [applications, setApplications] = useState([]);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  /* ── Firestore listeners ── */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const subs = [];
    const qs = (col, ...c) => query(collection(db, col), where("uid","==",uid), ...c);

    subs.push(onSnapshot(qs("assignments", where("is_completed","==",false)), s =>
      setAssignments(s.docs.map(d => ({ id:d.id,...d.data() })))));

    subs.push(onSnapshot(qs("todos", where("is_completed","==",false)), s =>
      setTodos(s.docs.map(d => ({ id:d.id,...d.data() })))));

    subs.push(onSnapshot(qs("classes", where("is_active","==",true)), s =>
      setClasses(s.docs.map(d => ({ id:d.id,...d.data() })))));

    subs.push(onSnapshot(qs("applications"), s =>
      setApplications(s.docs.map(d => ({ id:d.id,...d.data() })))));

    return () => subs.forEach(u => u());
  }, [user]);

  /* ── Calendar grid ── */
  const calDays = useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month+1, 0).getDate();
    const prevTotal = new Date(year, month, 0).getDate();
    const days = [];

    // Prev month fill
    for (let i = first-1; i >= 0; i--)
      days.push({ day: prevTotal-i, current: false, date: new Date(year, month-1, prevTotal-i) });

    // Current month
    for (let i = 1; i <= total; i++)
      days.push({ day: i, current: true, date: new Date(year, month, i) });

    // Next month fill
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++)
      days.push({ day: i, current: false, date: new Date(year, month+1, i) });

    return days;
  }, [currentDate]);

  /* ── Event helpers ── */
  const sameDay = (a, b) =>
    a.getFullYear()===b.getFullYear() &&
    a.getMonth()===b.getMonth() &&
    a.getDate()===b.getDate();

  const getEvents = (date) => {
    const events = [];

    assignments.forEach(a => {
      if (!a.due_date) return;
      const d = new Date(a.due_date);
      if (!sameDay(d, date)) return;
      const cls = classes.find(c => c.id === a.class_id);
      events.push({
        id: a.id, type: "assignment",
        title: a.title,
        color: cls?.color || "#6366f1",
        time: d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),
        meta: cls?.course_code,
        raw: a,
        navTo: "/assignments"
      });
    });

    todos.forEach(t => {
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      if (!sameDay(d, date)) return;
      events.push({
        id: t.id, type: "todo",
        title: t.title,
        color: "#10b981",
        time: d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),
        meta: t.priority,
        raw: t,
        navTo: "/todo"
      });
    });

    applications.forEach(app => {
      if (!app.interview_date) return;
      const d = new Date(app.interview_date);
      if (!sameDay(d, date)) return;
      events.push({
        id: app.id, type: "interview",
        title: `${app.company_organization} – ${app.position}`,
        color: "#f59e0b",
        time: app.interview_time || "",
        meta: "Interview",
        raw: app,
        navTo: "/career"
      });
    });

    // Sort by time
    return events.sort((a,b) => a.time.localeCompare(b.time));
  };

  const today = new Date();
  const isToday    = (d) => sameDay(d, today);
  const isSelected = (d) => selectedDay && sameDay(d, selectedDay);
  const isPast     = (d) => d < today && !isToday(d);

  /* selected day events */
  const selectedEvents = selectedDay ? getEvents(selectedDay) : [];

  /* all events in current month for the "upcoming" strip */
  const upcomingEvents = useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const result = [];
    for (let d=1; d<=31; d++) {
      const date = new Date(year, month, d);
      if (date.getMonth() !== month) break;
      const evs = getEvents(date);
      evs.forEach(e => result.push({ ...e, date }));
    }
    return result
      .filter(e => e.date >= today)
      .sort((a,b) => a.date-b.date)
      .slice(0, 8);
  }, [currentDate, assignments, todos, applications]);

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1));
  const goToday   = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  const typeIcon = (type) => {
    if (type==="assignment") return <FileText16/>;
    if (type==="todo")       return <CheckSquare size={13}/>;
    if (type==="interview")  return <Briefcase size={13}/>;
    return null;
  };

  // tiny inline icon workaround
  const FileText16 = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );

  if (!user) return (
    <div className="cal-signin">Please sign in to view calendar</div>
  );

  return (
    <div className="calendar-page">
      {/* ── Header ── */}
      <div className="cal-header">
        <div>
          <h1>Calendar</h1>
          <p>All your deadlines, tasks and interviews in one view</p>
        </div>
      </div>

      <div className="cal-layout">
        {/* ══════════ LEFT: CALENDAR GRID ══════════ */}
        <div className="cal-main">
          {/* Month nav */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth}>
              <ChevronLeft size={18}/>
            </button>
            <div className="cal-month-label">
              <h2>{MONTH_NAMES[currentDate.getMonth()]}</h2>
              <span>{currentDate.getFullYear()}</span>
            </div>
            <button className="cal-nav-btn" onClick={nextMonth}>
              <ChevronRight size={18}/>
            </button>
            <button className="cal-today-btn" onClick={goToday}>Today</button>
          </div>

          {/* Day name headers */}
          <div className="cal-day-names">
            {DAY_NAMES.map(d => (
              <div key={d} className="cal-day-name">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="cal-grid">
            {calDays.map((dayInfo, idx) => {
              const events    = getEvents(dayInfo.date);
              const todayFlag = isToday(dayInfo.date);
              const selFlag   = isSelected(dayInfo.date);
              const pastFlag  = isPast(dayInfo.date) && dayInfo.current;
              const maxDots   = 3;

              return (
                <div
                  key={idx}
                  className={[
                    "cal-cell",
                    !dayInfo.current ? "cal-cell-faded" : "",
                    todayFlag        ? "cal-cell-today" : "",
                    selFlag          ? "cal-cell-selected" : "",
                    pastFlag         ? "cal-cell-past" : "",
                    events.length>0  ? "cal-cell-has-events" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => dayInfo.current && setSelectedDay(dayInfo.date)}
                >
                  <span className="cal-cell-num">{dayInfo.day}</span>

                  {/* Event pills — show up to 2 labels + overflow dot */}
                  <div className="cal-cell-events">
                    {events.slice(0,2).map(e => (
                      <div
                        key={e.id}
                        className="cal-event-pill"
                        style={{ background: e.color+"22", borderColor: e.color+"55", color: e.color }}
                        onClick={ev => { ev.stopPropagation(); navigate(e.navTo); }}
                        title={e.title}
                      >
                        <span className="cal-pill-text">{e.title}</span>
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="cal-event-more">+{events.length-2} more</div>
                    )}
                  </div>

                  {/* Dot indicators (compact view) */}
                  {events.length > 0 && (
                    <div className="cal-cell-dots">
                      {events.slice(0, maxDots).map((e,i) => (
                        <span key={i}  style={{background:e.color}}/>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="cal-legend">
            <div className="cal-legend-item">
              <span className="cal-dot" style={{background:"#6366f1"}}/>
              <span>Assignments</span>
            </div>
            <div className="cal-legend-item">
              <span className="cal-dot" style={{background:"#10b981"}}/>
              <span>To-Do</span>
            </div>
            <div className="cal-legend-item">
              <span className="cal-dot" style={{background:"#f59e0b"}}/>
              <span>Interviews</span>
            </div>
            {classes.slice(0,3).map(cls => (
              <div key={cls.id} className="cal-legend-item">
                <span className="cal-dot" style={{background:cls.color||"#3b82f6"}}/>
                <span>{cls.course_code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════ RIGHT: DETAIL PANEL ══════════ */}
        <div className="cal-panel">

          {/* Selected day detail */}
          {selectedDay ? (
            <div className="cal-detail">
              <div className="cal-detail-header">
                <div className="cal-detail-date">
                  <span className="cal-detail-weekday">
                    {selectedDay.toLocaleDateString("en-US",{weekday:"long"})}
                  </span>
                  <span className="cal-detail-num">{selectedDay.getDate()}</span>
                  <span className="cal-detail-month">
                    {MONTH_NAMES[selectedDay.getMonth()]} {selectedDay.getFullYear()}
                  </span>
                </div>
                {isToday(selectedDay) && (
                  <span className="cal-today-badge">Today</span>
                )}
              </div>

              {selectedEvents.length === 0 ? (
                <div className="cal-detail-empty">
                  <span>🎉</span>
                  <span>Nothing scheduled</span>
                </div>
              ) : (
                <div className="cal-detail-events">
                  {selectedEvents.map(e => (
                    <div
                      key={e.id}
                      className="cal-detail-event"
                      style={{ borderLeftColor: e.color }}
                      onClick={() => navigate(e.navTo)}
                    >
                      <div className="cal-de-top">
                        <span className="cal-de-type" style={{color:e.color}}>
                          {e.type === "assignment" ? "Assignment" :
                           e.type === "todo"       ? "To-Do" : "Interview"}
                        </span>
                        {e.time && (
                          <span className="cal-de-time">
                            <Clock size={11}/> {e.time}
                          </span>
                        )}
                      </div>
                      <div className="cal-de-row">
                      <span className="cal-de-title">{e.title}</span>
                      
                      {e.meta && <span className="cal-de-meta">{e.meta}</span>}
                      
                      <span className="cal-de-link">
                        View in {e.type === "assignment" ? "Assignments" :
                                e.type === "todo"       ? "To-Do" : "Career"} →
                      </span>
                    </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="cal-panel-hint">
              <Calendar size={28}/>
              <span>Click a day to see events</span>
            </div>
          )}

          {/* Upcoming strip */}
          {upcomingEvents.length > 0 && (
            <div className="cal-upcoming">
              <div className="cal-upcoming-title">Upcoming</div>
              {upcomingEvents.map((e, idx) => (
                <div
                  key={idx}
                  className="cal-upcoming-row"
                  onClick={() => navigate(e.navTo)}
                  style={{"--ev-color": e.color}}
                >
                  <div className="cal-up-date">
                    <span className="cal-up-day">
                      {e.date.toLocaleDateString("en-US",{weekday:"short"})}
                    </span>
                    <span className="cal-up-num">{e.date.getDate()}</span>
                  </div>
                  <div className="cal-up-dot" style={{background:e.color}}/>
                  <div className="cal-up-info">
                    <span className="cal-up-title">{e.title}</span>
                    <span className="cal-up-meta" style={{ color: e.color, marginLeft: '8px' }}>
                      {e.type === "assignment" ? "Assignment" : e.type === "todo" ? "To-Do" : "Interview"}
                      {e.meta ? ` · ${e.meta}` : ""}
                    </span>
                  </div>
                  {e.time && (
                    <span className="cal-up-time">{e.time}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
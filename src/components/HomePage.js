import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  doc, getDoc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, FileText, Calendar, StickyNote,
  CheckSquare, Briefcase, GraduationCap, Trophy,
  Calculator, Clock, AlertCircle, ChevronRight
} from "lucide-react";
import { computeAllStats, gradeColor } from "../utils/gradeUtils";
import "../styles/HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();

  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [pendingA, setPendingA]     = useState([]);
  const [gradedA, setGradedA]       = useState([]);
  const [todos, setTodos]           = useState([]);
  const [applications, setApps]     = useState([]);
  const [notes, setNotes]           = useState([]);
  const [semesters, setSemesters]   = useState([]);
  const [coreReqs, setCoreReqs]     = useState([]);
  const [majorReqs, setMajorReqs]   = useState([]);
  const [minorReqs, setMinorReqs]   = useState([]);
  const [catWeights, setCatWeights] = useState({});
  const [globalScale, setGlobalScale] = useState(null);

  /* auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  /* listeners */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const subs = [];

    const sub = (q, setter) =>
      subs.push(onSnapshot(q, s => setter(s.docs?.map(d => ({ id: d.id, ...d.data() })))));

    sub(doc(db, "users", uid), snap => {
      // doc snapshot — different API
    });
    subs.push(onSnapshot(doc(db, "users", uid), s => {
      if (s.exists()) setProfile(s.data());
    }));

    const col = (name, ...constraints) =>
      query(collection(db, name), where("uid", "==", uid), ...constraints);

    // ALL classes — needed so archived ones count toward degree
    sub(col("classes"), setAllClasses);

    sub(col("assignments", where("is_completed", "==", false)),
      data => setPendingA(data.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))));

    sub(col("assignments",
        where("is_completed", "==", true),
        where("is_graded",    "==", true)), setGradedA);

    sub(col("todos", where("is_completed", "==", false)), setTodos);
    sub(col("applications"), data =>
      setApps(data.sort((a, b) => new Date(b.applied_date || 0) - new Date(a.applied_date || 0))));
    sub(col("notes"), data =>
      setNotes(data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))));

    sub(query(collection(db, "degreeSemesters"), where("uid", "==", uid)), setSemesters);
    sub(query(collection(db, "coreRequirements"),  where("uid", "==", uid)), setCoreReqs);
    sub(query(collection(db, "majorRequirements"), where("uid", "==", uid)), setMajorReqs);
    sub(query(collection(db, "minorRequirements"), where("uid", "==", uid)), setMinorReqs);

    const loadExtras = async () => {
      const w = await getDoc(doc(db, "categoryWeights", uid));
      if (w.exists()) setCatWeights(w.data().weights || {});
      const g = await getDoc(doc(db, "gpaScale", uid));
      if (g.exists()) setGlobalScale(g.data().scale || null);
    };
    loadExtras();

    return () => subs.forEach(u => u());
  }, [user]);

  /* ── Central stats — same function as DegreePlanner & Profile ── */
  const stats = useMemo(() => computeAllStats({
    allClasses,
    semesters,
    coreReqs,
    majorReqs,
    minorReqs,
    profile:           profile || {},
    gradedAssignments: gradedA,
    categoryWeights:   catWeights,
    globalScale,
  }), [allClasses, semesters, coreReqs, majorReqs, minorReqs,
       profile, gradedA, catWeights, globalScale]);

  /* ── Helpers ── */
  const activeClasses = allClasses.filter(c => c.is_active);
  const now      = new Date();
  const todayStr = now.toDateString();
  const todayDay = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];

  const todayClasses = activeClasses
    .filter(c => c.days?.includes(todayDay))
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const isOverdue  = ds => ds && new Date(ds) < now && new Date(ds).toDateString() !== todayStr;
  const isToday    = ds => ds && new Date(ds).toDateString() === todayStr;
  const isTomorrow = ds => {
    if (!ds) return false;
    const t = new Date(); t.setDate(t.getDate() + 1);
    return new Date(ds).toDateString() === t.toDateString();
  };

  const overdueList = pendingA.filter(a => isOverdue(a.due_date));
  const dueTodayList = pendingA.filter(a => isToday(a.due_date));
  const dueSoon  = pendingA.filter(a => {
    if (!a.due_date) return false;
    const d = (new Date(a.due_date) - now) / 86400000;
    return d >= 0 && d <= 7;
  });

  const formatDue = ds => {
    if (!ds) return "";
    if (isOverdue(ds))  return "Overdue";
    if (isToday(ds))    return "Today";
    if (isTomorrow(ds)) return "Tomorrow";
    const d = Math.ceil((new Date(ds) - now) / 86400000);
    if (d <= 7) return `${d}d`;
    return new Date(ds).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const dueClass = ds => {
    const t = formatDue(ds);
    if (t === "Overdue")  return "due-overdue";
    if (t === "Today")    return "due-today";
    if (t === "Tomorrow") return "due-tomorrow";
    return "";
  };

  const statusColor = s =>
    ({ Interview: "#3b82f6", Offer: "#10b981",
       Rejected: "#ef4444", Accepted: "#22c55e" }[s] || "#64748b");

  const gpaCol = g => g ? gradeColor(Number(g), 4.0) : "var(--text-muted)";

  if (!user) return (
    <div className="hp-signin">
      <div className="hp-signin-content">
        <span>🎓</span>
        <h2>Sign in to view your dashboard</h2>
      </div>
    </div>
  );

  return (
    <div className="homepage">

      {/* ── Hero ── */}
      <div className="hp-hero stagger-1">
        <div className="hp-hero-text">
          <h1>
            {now.getHours() < 12 ? "Good morning"
              : now.getHours() < 17 ? "Good afternoon" : "Good evening"},
            <span className="hp-hero-name">
              {" "}{profile?.display_name?.split(" ")[0] || "Student"}
            </span>
          </h1>
          <p className="hp-hero-sub">
            {todayClasses.length > 0
              ? `${todayClasses.length} class${todayClasses.length > 1 ? "es" : ""} today`
              : "No classes today"}
            {dueTodayList.length > 0 &&
              ` · ${dueTodayList.length} assignment${dueTodayList.length > 1 ? "s" : ""} due`}
          </p>
        </div>
        {(overdueList.length > 0 || dueTodayList.length > 0) && (
          <div className="hp-alert" onClick={() => navigate("/assignments")}>
            <AlertCircle size={15} />
            <span>
              {overdueList.length > 0
                ? `${overdueList.length} overdue`
                : `${dueTodayList.length} due today`}
            </span>
            <ChevronRight size={14} />
          </div>
        )}
      </div>

      {/* ── Stats row — all from computeAllStats ── */}
      <div className="hp-stats stagger-2">

        <Link to="/gpacalculator" className="hp-stat">
          <div className="hp-stat-icon" style={{ background: "rgba(6,182,212,0.12)", color: "#22d3ee" }}>
            <Calculator size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val" style={{ color: gpaCol(stats.cumulativeGpa) }}>
              {stats.cumulativeGpa ? Number(stats.cumulativeGpa).toFixed(2) : "—"}
            </span>
            <span className="hp-stat-label">Cumulative GPA</span>
          </div>
        </Link>

        <Link to="/degree-planner" className="hp-stat">
          <div className="hp-stat-icon" style={{ background: "rgba(236,72,153,0.12)", color: "#f472b6" }}>
            <GraduationCap size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val">{stats.degreeProgress.toFixed(0)}%</span>
            <span className="hp-stat-label">
              {stats.totalForDegree} / {stats.degreeReq} cr
            </span>
          </div>
          <div className="hp-stat-progress">
            <div className="hp-stat-bar"
              style={{ width: `${stats.degreeProgress}%`, background: "#ec4899" }} />
          </div>
        </Link>

        <Link to="/assignments" className="hp-stat">
          <div className="hp-stat-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
            <FileText size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val">{pendingA.length}</span>
            <span className="hp-stat-label">Pending</span>
          </div>
          {overdueList.length > 0 && (
            <span className="hp-stat-badge">{overdueList.length} late</span>
          )}
        </Link>

        <Link to="/gradetracker" className="hp-stat">
          <div className="hp-stat-icon" style={{ background: "rgba(234,179,8,0.12)", color: "#facc15" }}>
            <Trophy size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val">{gradedA.length}</span>
            <span className="hp-stat-label">Graded</span>
          </div>
        </Link>

      </div>

      {/* ── Main grid ── */}
      <div className="hp-grid stagger-3">

        {/* Today's schedule */}
        <div className="hp-card">
          <div className="hp-card-header">
            <div className="hp-card-title"><BookOpen size={16} /><span>Today's Schedule</span></div>
            <Link to="/classes" className="hp-card-link">View all <ChevronRight size={14} /></Link>
          </div>
          {todayClasses.length > 0 ? (
            <div className="hp-schedule">
              {todayClasses.map(cls => (
                <div key={cls.id} className="hp-schedule-item"
                  onClick={() => navigate("/classes")}>
                  <div className="hp-schedule-bar"
                    style={{ background: cls.color || "#3b82f6" }} />
                  <div className="hp-schedule-info">
                    <span className="hp-schedule-code"
                      style={{ color: cls.color }}>{cls.course_code}</span>
                    <span className="hp-schedule-name">{cls.course_name}</span>
                  </div>
                  <div className="hp-schedule-time">
                    <Clock size={12} />
                    <span>{cls.start_time} – {cls.end_time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="hp-empty-inline">🎉 No classes today — enjoy your day!</div>
          )}
        </div>

        {/* Assignments */}
        <div className="hp-card">
          <div className="hp-card-header">
            <div className="hp-card-title"><FileText size={16} /><span>Assignments</span></div>
            <Link to="/assignments" className="hp-card-link">See all <ChevronRight size={14} /></Link>
          </div>
          {dueSoon.length > 0 ? (
            <div className="hp-list">
              {dueSoon.slice(0, 5).map(a => {
                const cls = activeClasses.find(c => c.id === a.class_id);
                return (
                  <div key={a.id} className="hp-list-item"
                    onClick={() => navigate("/assignments")}>
                    <div className="hp-list-dot"
                      style={{ background: cls?.color || "#6366f1" }} />
                    <div className="hp-list-info">
                      <span className="hp-list-title">{a.title}</span>
                      <span className="hp-list-sub">{cls?.course_code || "—"}</span>
                    </div>
                    <span className={`hp-due ${dueClass(a.due_date)}`}>
                      {formatDue(a.due_date)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="hp-empty-inline">✨ All caught up!</div>
          )}
        </div>

        {/* To-Do */}
        <div className="hp-card">
          <div className="hp-card-header">
            <div className="hp-card-title"><CheckSquare size={16} /><span>To-Do</span></div>
            <Link to="/todo" className="hp-card-link">See all <ChevronRight size={14} /></Link>
          </div>
          {todos.length > 0 ? (
            <div className="hp-list">
              {todos.slice(0, 4).map(t => (
                <div key={t.id} className="hp-list-item"
                  onClick={() => navigate("/todo")}>
                  <div className={`hp-todo-check hp-priority-${t.priority?.toLowerCase()}`} />
                  <span className="hp-list-title">{t.title}</span>
                  <span className={`hp-priority-tag hp-priority-${t.priority?.toLowerCase()}`}>
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="hp-empty-inline">No tasks pending</div>
          )}
        </div>

        {/* Career */}
        <div className="hp-card">
          <div className="hp-card-header">
            <div className="hp-card-title"><Briefcase size={16} /><span>Career</span></div>
            <Link to="/career" className="hp-card-link">See all <ChevronRight size={14} /></Link>
          </div>
          {applications.length > 0 ? (
            <div className="hp-list">
              {applications.slice(0, 4).map(app => (
                <div key={app.id} className="hp-list-item"
                  onClick={() => navigate("/career")}>
                  <div className="hp-list-info">
                    <span className="hp-list-title">{app.position}</span>
                    <span className="hp-list-sub">{app.company_organization}</span>
                  </div>
                  <span className="hp-status-pill" style={{
                    background: statusColor(app.status) + "22",
                    color: statusColor(app.status),
                  }}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="hp-empty-inline">No applications yet</div>
          )}
        </div>

        {/* Notes */}
        <div className="hp-card">
          <div className="hp-card-header">
            <div className="hp-card-title"><StickyNote size={16} /><span>Recent Notes</span></div>
            <Link to="/notes" className="hp-card-link">See all <ChevronRight size={14} /></Link>
          </div>
          {notes.length > 0 ? (
            <div className="hp-notes-grid">
              {notes.slice(0, 3).map(note => {
                const cls = activeClasses.find(c => c.id === note.class_id);
                return (
                  <div key={note.id} className="hp-note-chip"
                    onClick={() => navigate("/notes")}>
                    <div className="hp-note-chip-bar"
                      style={{ background: cls?.color || "#a855f7" }} />
                    <div className="hp-note-chip-body">
                      <span className="hp-note-chip-title">{note.title}</span>
                      <span className="hp-note-chip-sub">
                        {cls?.course_code || "General"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="hp-empty-inline">No notes yet</div>
          )}
        </div>

        {/* Calendar snapshot */}
        <div className="hp-card hp-card-calendar"
          onClick={() => navigate("/calendar")}>
          <div className="hp-card-header">
            <div className="hp-card-title"><Calendar size={16} /><span>Calendar</span></div>
            <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="hp-cal-snap">
            <div className="hp-cal-date-big">
              <span className="hp-cal-day-name">
                {now.toLocaleDateString("en-US", { weekday: "long" })}
              </span>
              <span className="hp-cal-day-num">{now.getDate()}</span>
              <span className="hp-cal-month">
                {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="hp-cal-stats">
              <div className="hp-cal-stat">
                <span className="hp-cal-num">{todayClasses.length}</span>
                <span>Classes</span>
              </div>
              <div className="hp-cal-stat">
                <span className="hp-cal-num">{dueTodayList.length}</span>
                <span>Due Today</span>
              </div>
              <div className="hp-cal-stat">
                <span className="hp-cal-num">{todos.length}</span>
                <span>Tasks</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
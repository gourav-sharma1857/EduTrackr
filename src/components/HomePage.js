import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, onSnapshot as docSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, FileText, Calendar, StickyNote,
  CheckSquare, Briefcase, GraduationCap, Trophy,
  Calculator, TrendingUp, Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import "../styles/HomePage.css";
import "../styles/globals.css";


export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [classes, setClasses]         = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos]             = useState([]);
  const [applications, setApplications] = useState([]);
  const [notes, setNotes]             = useState([]);
  const [gradedAssignments, setGradedAssignments] = useState([]);
  const [semesters, setSemesters]     = useState([]);
  const [coreReqs, setCoreReqs]       = useState([]);
  const [majorReqs, setMajorReqs]     = useState([]);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  /* ── All real-time listeners ── */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const subs = [];

    subs.push(onSnapshot(doc(db, "users", uid), (s) => { if (s.exists()) setProfile(s.data()); }));

    const qs = (col, ...constraints) =>
      query(collection(db, col), where("uid", "==", uid), ...constraints);

    subs.push(onSnapshot(qs("classes", where("is_active","==",true)), (s) =>
      setClasses(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    subs.push(onSnapshot(qs("assignments", where("is_completed","==",false)), (s) =>
      setAssignments(s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => new Date(a.due_date) - new Date(b.due_date)))));

    subs.push(onSnapshot(qs("assignments", where("is_completed","==",true), where("is_graded","==",true)), (s) =>
      setGradedAssignments(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    subs.push(onSnapshot(qs("todos", where("is_completed","==",false)), (s) =>
      setTodos(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    subs.push(onSnapshot(qs("applications"), (s) =>
      setApplications(s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => new Date(b.applied_date||0) - new Date(a.applied_date||0)))));

    subs.push(onSnapshot(qs("notes"), (s) =>
      setNotes(s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)))));

    subs.push(onSnapshot(query(collection(db,"degreeSemesters"), where("uid","==",uid)), (s) =>
      setSemesters(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    subs.push(onSnapshot(query(collection(db,"coreRequirements"), where("uid","==",uid)), (s) =>
      setCoreReqs(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    subs.push(onSnapshot(query(collection(db,"majorRequirements"), where("uid","==",uid)), (s) =>
      setMajorReqs(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    return () => subs.forEach(u => u());
  }, [user]);

  /* ── Helpers ── */
  const now = new Date();
  const todayStr = now.toDateString();
  const todayDay = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];
  const todayClasses = classes
    .filter(c => c.days?.includes(todayDay))
    .sort((a,b) => (a.start_time||"").localeCompare(b.start_time||""));

  const dueToday  = assignments.filter(a => a.due_date && new Date(a.due_date).toDateString() === todayStr);
  const overdue   = assignments.filter(a => a.due_date && new Date(a.due_date) < now);
  const dueSoon   = assignments.filter(a => {
    if (!a.due_date) return false;
    const d = new Date(a.due_date);
    const diff = (d - now) / 86400000;
    return diff >= 0 && diff <= 7;
  });

  const formatDue = (ds) => {
    if (!ds) return "";
    const d = new Date(ds);
    const diff = Math.ceil((d - now) / 86400000);
    if (diff < 0)  return "Overdue";
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff <= 7)  return `${diff}d`;
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  };

  const dueClass = (ds) => {
    const t = formatDue(ds);
    if (t === "Overdue") return "due-overdue";
    if (t === "Today")   return "due-today";
    if (t === "Tomorrow") return "due-tomorrow";
    return "";
  };

  /* ── GPA calc ── */
  const calcGpa = () => {
    const prior    = Number(profile?.current_gpa || 0);
    const priorCr  = Number(profile?.completed_credit_hours || 0);
    const getGpts  = (p) => {
      if (p>=93) return 4.0; if (p>=90) return 3.67; if (p>=87) return 3.33;
      if (p>=83) return 3.0; if (p>=80) return 2.67; if (p>=77) return 2.33;
      if (p>=73) return 2.0; if (p>=70) return 1.67; if (p>=67) return 1.33;
      if (p>=63) return 1.0; if (p>=60) return 0.67; return 0;
    };
    let pts=0, cr=0;
    classes.forEach(cls => {
      const asgn = gradedAssignments.filter(a => a.class_id === cls.id);
      if (!asgn.length || !cls.credit_hours) return;
      const total  = asgn.reduce((s,a) => s+(a.total_points||0), 0);
      const earned = asgn.reduce((s,a) => s+(a.earned_points||0), 0);
      if (total > 0) {
        pts += getGpts((earned/total)*100) * cls.credit_hours;
        cr  += cls.credit_hours;
      }
    });
    const totalPts = prior * priorCr + pts;
    const totalCr  = priorCr + cr;
    return totalCr > 0 ? (totalPts/totalCr).toFixed(2) : prior ? prior.toFixed(2) : null;
  };

  const gpa = calcGpa();

  /* ── Degree progress ── */
  const calcDegree = () => {
    const req = Number(profile?.degree_credit_requirement || 120);
    const done = new Map();
    [...coreReqs, ...majorReqs].forEach(c => {
      if (c.status==="Completed"||c.status==="Transferred"||c.is_completed)
        done.set(c.course_code, Number(c.credit_hours)||0);
    });
    semesters.forEach(s => (s.courses||[]).forEach(c => {
      if (c.status==="Completed"||c.status==="Transferred")
        done.set(c.course_code, Number(c.credit_hours)||0);
    }));
    const credits = Array.from(done.values()).reduce((a,b)=>a+b,0)
      + Number(profile?.completed_credit_hours||0);
    return { credits: Math.min(credits, req), req, pct: Math.min((credits/req)*100,100) };
  };

  const degree = calcDegree();

  const statusColor = (s) => {
    const m = { Interview:"#3b82f6", Offer:"#10b981", Rejected:"#ef4444", Accepted:"#22c55e" };
    return m[s] || "#64748b";
  };

  const gpaColor = (g) => {
    if (!g) return "var(--text-muted)";
    const n = Number(g);
    if (n >= 3.7) return "#10b981"; if (n >= 3.0) return "#3b82f6";
    if (n >= 2.5) return "#f59e0b"; return "#ef4444";
  };

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
            {new Date().getHours() < 12 ? "Good morning" :
             new Date().getHours() < 17 ? "Good afternoon" : "Good evening"},
            <span className="hp-hero-name"> {profile?.display_name?.split(" ")[0] || "Student"}</span>
          </h1>
          <p className="hp-hero-sub">
            {todayClasses.length > 0
              ? `You have ${todayClasses.length} class${todayClasses.length>1?"es":""} today`
              : "No classes today"
            }
            {dueToday.length > 0 && ` · ${dueToday.length} assignment${dueToday.length>1?"s":""} due`}
          </p>
        </div>
        {(overdue.length > 0 || dueToday.length > 0) && (
          <div className="hp-alert" onClick={() => navigate("/assignments")}>
            <AlertCircle size={15} />
            <span>
              {overdue.length > 0
                ? `${overdue.length} overdue assignment${overdue.length>1?"s":""}`
                : `${dueToday.length} due today`}
            </span>
            <ChevronRight size={14} />
          </div>
        )}
      </div>

      {/* ── Stat Row ── */}
      <div className="hp-stats stagger-2">
        <Link to="/gpacalculator" className="hp-stat">
          <div className="hp-stat-icon" style={{ background:"rgba(6,182,212,0.12)", color:"#22d3ee" }}>
            <Calculator size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val" style={{ color: gpaColor(gpa) }}>
              {gpa || "—"}
            </span>
            <span className="hp-stat-label">GPA</span>
          </div>
        </Link>

        <Link to="/degree-planner" className="hp-stat">
          <div className="hp-stat-icon" style={{ background:"rgba(236,72,153,0.12)", color:"#f472b6" }}>
            <GraduationCap size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val">{degree.pct.toFixed(0)}%</span>
            <span className="hp-stat-label">{degree.credits}/{degree.req} cr</span>
          </div>
          <div className="hp-stat-progress">
            <div className="hp-stat-bar" style={{ width:`${degree.pct}%`, background:"#ec4899" }} />
          </div>
        </Link>

        <Link to="/assignments" className="hp-stat">
          <div className="hp-stat-icon" style={{ background:"rgba(99,102,241,0.12)", color:"#818cf8" }}>
            <FileText size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val">{assignments.length}</span>
            <span className="hp-stat-label">Pending</span>
          </div>
          {overdue.length > 0 && (
            <span className="hp-stat-badge">{overdue.length} late</span>
          )}
        </Link>

        <Link to="/gradetracker" className="hp-stat">
          <div className="hp-stat-icon" style={{ background:"rgba(234,179,8,0.12)", color:"#facc15" }}>
            <Trophy size={22} />
          </div>
          <div className="hp-stat-body">
            <span className="hp-stat-val">{gradedAssignments.length}</span>
            <span className="hp-stat-label">Graded</span>
          </div>
        </Link>
      </div>

      {/* ── Main Grid ── */}
      <div className="hp-grid stagger-3">

        {/* Today's Schedule */}
        <div className="hp-card ">
          <div className="hp-card-header">
            <div className="hp-card-title">
              <BookOpen size={16} />
              <span>Today's Schedule</span>
            </div>
            <Link to="/classes" className="hp-card-link">View all <ChevronRight size={14}/></Link>
          </div>
          {todayClasses.length > 0 ? (
            <div className="hp-schedule">
              {todayClasses.map(cls => (
                <div key={cls.id} className="hp-schedule-item" onClick={() => navigate("/classes")}>
                  <div className="hp-schedule-bar" style={{ background: cls.color || "#3b82f6" }} />
                  <div className="hp-schedule-info">
                    <span className="hp-schedule-code" style={{ color: cls.color }}>{cls.course_code}</span>
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
            <div className="hp-card-title">
              <FileText size={16} />
              <span>Assignments</span>
            </div>
            <Link to="/assignments" className="hp-card-link">See all <ChevronRight size={14}/></Link>
          </div>
          {dueSoon.length > 0 ? (
            <div className="hp-list">
              {dueSoon.slice(0,5).map(a => {
                const cls = classes.find(c => c.id === a.class_id);
                return (
                  <div key={a.id} className="hp-list-item" onClick={() => navigate("/assignments")}>
                    <div className="hp-list-dot" style={{ background: cls?.color || "#6366f1" }} />
                    <div className="hp-list-info">
                      <span className="hp-list-title">{a.title}</span>
                      <span className="hp-list-sub">{cls?.course_code || "—"}</span>
                    </div>
                    <span className={`hp-due ${dueClass(a.due_date)}`}>{formatDue(a.due_date)}</span>
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
            <div className="hp-card-title">
              <CheckSquare size={16} />
              <span>To-Do</span>
            </div>
            <Link to="/todo" className="hp-card-link">See all <ChevronRight size={14}/></Link>
          </div>
          {todos.length > 0 ? (
            <div className="hp-list">
              {todos.slice(0,4).map(t => (
                <div key={t.id} className="hp-list-item" onClick={() => navigate("/todo")}>
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
            <div className="hp-card-title">
              <Briefcase size={16} />
              <span>Career</span>
            </div>
            <Link to="/career" className="hp-card-link">See all <ChevronRight size={14}/></Link>
          </div>
          {applications.length > 0 ? (
            <div className="hp-list">
              {applications.slice(0,4).map(app => (
                <div key={app.id} className="hp-list-item" onClick={() => navigate("/career")}>
                  <div className="hp-list-info">
                    <span className="hp-list-title">{app.position}</span>
                    <span className="hp-list-sub">{app.company_organization}</span>
                  </div>
                  <span className="hp-status-pill" style={{
                    background: statusColor(app.status) + "22",
                    color: statusColor(app.status)
                  }}>{app.status}</span>
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
            <div className="hp-card-title">
              <StickyNote size={16} />
              <span>Recent Notes</span>
            </div>
            <Link to="/notes" className="hp-card-link">See all <ChevronRight size={14}/></Link>
          </div>
          {notes.length > 0 ? (
            <div className="hp-notes-grid">
              {notes.slice(0,3).map(note => {
                const cls = classes.find(c => c.id === note.class_id);
                return (
                  <div key={note.id} className="hp-note-chip" onClick={() => navigate("/notes")}>
                    <div className="hp-note-chip-bar" style={{ background: cls?.color || "#a855f7" }} />
                    <div className="hp-note-chip-body">
                      <span className="hp-note-chip-title">{note.title}</span>
                      <span className="hp-note-chip-sub">{cls?.course_code || "General"}</span>
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
        <div className="hp-card hp-card-calendar" onClick={() => navigate("/calendar")}>
          <div className="hp-card-header">
            <div className="hp-card-title">
              <Calendar size={16} />
              <span>Calendar</span>
            </div>
            <ChevronRight size={14} style={{ color:"var(--text-muted)" }} />
          </div>
          <div className="hp-cal-snap">
            <div className="hp-cal-date-big">
              <span className="hp-cal-day-name">
                {now.toLocaleDateString("en-US",{weekday:"long"})}
              </span>
              <span className="hp-cal-day-num">{now.getDate()}</span>
              <span className="hp-cal-month">
                {now.toLocaleDateString("en-US",{month:"long", year:"numeric"})}
              </span>
            </div>
            <div className="hp-cal-stats">
              <div className="hp-cal-stat">
                <span className="hp-cal-num">{todayClasses.length}</span>
                <span>Classes</span>
              </div>
              <div className="hp-cal-stat">
                <span className="hp-cal-num">{dueToday.length}</span>
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
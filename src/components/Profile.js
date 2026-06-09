import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  User, Link2, GraduationCap, Edit2, Save, X,
  Plus, Trash2, ExternalLink, Github, Linkedin,
  Globe, Briefcase, TrendingUp, FileText,
  StickyNote, Calendar, CheckSquare
} from "lucide-react";
import { computeAllStats, gradeColor } from "../utils/gradeUtils";
import "../styles/Profile.css";

const YEAR_OPTIONS = ["Freshman","Sophomore","Junior","Senior","Graduate","Alumni"];
const AVATAR_COLORS = [
  "linear-gradient(135deg,#3b82f6,#6366f1)",
  "linear-gradient(135deg,#10b981,#14b8a6)",
  "linear-gradient(135deg,#f59e0b,#f97316)",
  "linear-gradient(135deg,#ec4899,#a855f7)",
  "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "linear-gradient(135deg,#84cc16,#10b981)",
];

export default function Profile() {
  const [user, setUser]           = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [savedMsg, setSavedMsg]   = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  /* live data for stats */
  const [allClasses, setAllClasses]   = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos]             = useState([]);
  const [notes, setNotes]             = useState([]);
  const [applications, setApps]       = useState([]);
  const [gradedA, setGradedA]         = useState([]);
  const [semesters, setSemesters]     = useState([]);
  const [coreReqs, setCoreReqs]       = useState([]);
  const [majorReqs, setMajorReqs]     = useState([]);
  const [minorReqs, setMinorReqs]     = useState([]);
  const [catWeights, setCatWeights]   = useState({});
  const [globalScale, setGlobalScale] = useState(null);

  const blankForm = {
    display_name:"", major:"", school_year:"Freshman",
    university:"", bio:"",
    linkedin_url:"", github_url:"", handshake_url:"",
    portfolio_url:"", custom_links:[],
    degree_credit_requirement:120,
    completed_credit_hours:0,
    current_gpa:"",
    avatarColor: AVATAR_COLORS[0],
  };
  const [form, setForm] = useState(blankForm);

  /* auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  /* load profile form data */
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          display_name:              d.display_name || user.displayName || "",
          major:                     d.major || "",
          school_year:               d.school_year || "Freshman",
          university:                d.university || "",
          bio:                       d.bio || "",
          linkedin_url:              d.linkedin_url || "",
          github_url:                d.github_url || "",
          handshake_url:             d.handshake_url || "",
          portfolio_url:             d.portfolio_url || "",
          custom_links:              d.custom_links || [],
          degree_credit_requirement: d.degree_credit_requirement || 120,
          completed_credit_hours:    d.completed_credit_hours || 0,
          current_gpa:               d.current_gpa ?? "",
          avatarColor:               d.avatarColor || AVATAR_COLORS[0],
        });
      }
    };
    load();
  }, [user]);

  /* live listeners */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const subs = [];
    const col = (name, ...c) => query(collection(db, name), where("uid","==",uid), ...c);
    const sub = (q, setter) =>
      subs.push(onSnapshot(q, s => setter(s.docs.map(d => ({ id:d.id,...d.data() })))));

    // ALL classes so archived ones feed into stats
    sub(col("classes"), setAllClasses);
    sub(col("assignments"), setAssignments);
    sub(col("todos"), setTodos);
    sub(col("notes"), setNotes);
    sub(col("applications"), setApps);
    sub(col("assignments",
        where("is_completed","==",true),
        where("is_graded","==",true)), setGradedA);
    sub(query(collection(db,"degreeSemesters"), where("uid","==",uid)), setSemesters);
    sub(query(collection(db,"coreRequirements"),  where("uid","==",uid)), setCoreReqs);
    sub(query(collection(db,"majorRequirements"), where("uid","==",uid)), setMajorReqs);
    sub(query(collection(db,"minorRequirements"), where("uid","==",uid)), setMinorReqs);

    const loadExtras = async () => {
      const w = await getDoc(doc(db,"categoryWeights",uid));
      if (w.exists()) setCatWeights(w.data().weights||{});
      const g = await getDoc(doc(db,"gpaScale",uid));
      if (g.exists()) setGlobalScale(g.data().scale||null);
    };
    loadExtras();

    return () => subs.forEach(u => u());
  }, [user]);

  /* ── Central stats — same function as DegreePlanner & HomePage ── */
  const stats = useMemo(() => computeAllStats({
    allClasses,
    semesters,
    coreReqs,
    majorReqs,
    minorReqs,
    profile:           form,        // use the form so live edits preview instantly
    gradedAssignments: gradedA,
    categoryWeights:   catWeights,
    globalScale,
  }), [allClasses, semesters, coreReqs, majorReqs, minorReqs,
       form, gradedA, catWeights, globalScale]);

  /* ── Save ── */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db,"users",user.uid), {
        ...form,
        current_gpa:               form.current_gpa === "" ? null : Number(form.current_gpa),
        degree_credit_requirement: Number(form.degree_credit_requirement),
        completed_credit_hours:    Number(form.completed_credit_hours),
      }, { merge:true });
      setIsEditing(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch(err) { console.error(err); }
    setIsSaving(false);
  };

  /* custom links helpers */
  const addLink    = () => setForm(f=>({...f,custom_links:[...f.custom_links,{label:"",url:""}]}));
  const updateLink = (i,field,val) => {
    const links = [...form.custom_links];
    links[i] = {...links[i],[field]:val};
    setForm(f=>({...f,custom_links:links}));
  };
  const removeLink = i =>
    setForm(f=>({...f,custom_links:f.custom_links.filter((_,idx)=>idx!==i)}));

  /* derived quick stats */
  const activeClasses  = allClasses.filter(c => c.is_active);
  const pendingA       = assignments.filter(a => !a.is_completed);
  const completedA     = assignments.filter(a =>  a.is_completed);
  const overdueA       = pendingA.filter(a => a.due_date && new Date(a.due_date) < new Date());
  const offers         = applications.filter(a => a.status==="Offer"||a.status==="Accepted");
  const todayDay       = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
  const todayClasses   = activeClasses.filter(c => c.days?.includes(todayDay));

  const getInitials = () => {
    const n = form.display_name || user?.displayName || "S";
    return n.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
  };
  const gpaCol = g => g ? gradeColor(Number(g), 4.0) : "var(--text-muted)";

  if (!user) return <div className="pf-signin">Please sign in to view your profile</div>;

  return (
    <div className="profile-page">

      {/* ── Hero ── */}
      <div className="pf-hero stagger-1">
        <div className="pf-avatar-wrap">
          <div className="pf-avatar" style={{background:form.avatarColor}}>
            {getInitials()}
          </div>
          {isEditing && (
            <div className="pf-avatar-colors">
              {AVATAR_COLORS.map((c,i)=>(
                <button key={i}
                  className={"pf-color-btn"+(form.avatarColor===c?" active":"")}
                  style={{background:c}}
                  onClick={()=>setForm(f=>({...f,avatarColor:c}))}/>
              ))}
            </div>
          )}
        </div>

        <div className="pf-hero-info">
          {isEditing ? (
            <input className="pf-name-input" placeholder="Your name"
              value={form.display_name}
              onChange={e=>setForm(f=>({...f,display_name:e.target.value}))}/>
          ) : (
            <h1 className="pf-hero-name">{form.display_name || "Your Name"}</h1>
          )}
          <div className="pf-hero-meta">
            {form.university  && <span className="pf-meta-chip">🏫 {form.university}</span>}
            {form.major       && <span className="pf-meta-chip">📚 {form.major}</span>}
            {form.school_year && <span className="pf-meta-chip">🎓 {form.school_year}</span>}
            {user.email       && <span className="pf-meta-chip">✉ {user.email}</span>}
          </div>
          {form.bio && !isEditing && <p className="pf-bio">{form.bio}</p>}
        </div>

        <div className="pf-hero-actions">
          {savedMsg && <span className="pf-saved-msg">✓ Saved!</span>}
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={()=>setIsEditing(false)}>
                <X size={15}/> Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                <Save size={15}/> {isSaving?"Saving…":"Save"}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={()=>setIsEditing(true)}>
              <Edit2 size={15}/> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Stats strip — from computeAllStats ── */}
      <div className="pf-stats stagger-2">
        <div className="pf-stat">
          <span className="pf-stat-val" style={{color:gpaCol(stats.cumulativeGpa)}}>
            {stats.cumulativeGpa ? Number(stats.cumulativeGpa).toFixed(2) : "—"}
          </span>
          <span className="pf-stat-label">Cumulative GPA</span>
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          {/* SAME number as DegreePlanner */}
          <span className="pf-stat-val">{stats.totalForDegree}</span>
          <span className="pf-stat-label">Credits Done</span>
          <div className="pf-stat-mini-bar">
            <div style={{
              width: stats.degreeReq > 0
                ? Math.min((stats.totalForDegree/stats.degreeReq)*100,100)+"%"
                : "0%",
              background:"#ec4899", height:"100%", borderRadius:"2px"
            }}/>
          </div>
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{stats.degreeProgress.toFixed(0)}%</span>
          <span className="pf-stat-label">Degree Progress</span>
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{activeClasses.length}</span>
          <span className="pf-stat-label">Active Classes</span>
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{pendingA.length}</span>
          <span className="pf-stat-label">Pending</span>
          {overdueA.length>0 && <span className="pf-stat-warn">{overdueA.length} overdue</span>}
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{completedA.length}</span>
          <span className="pf-stat-label">Completed</span>
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{applications.length}</span>
          <span className="pf-stat-label">Applications</span>
          {offers.length>0 && <span className="pf-stat-offers">{offers.length} offer{offers.length>1?"s":""}</span>}
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{notes.length}</span>
          <span className="pf-stat-label">Notes</span>
        </div>
        <div className="pf-stat-divider"/>
        <div className="pf-stat">
          <span className="pf-stat-val">{todos.filter(t=>!t.is_completed).length}</span>
          <span className="pf-stat-label">Tasks</span>
        </div>
      </div>

      {/* ── Quick links (view mode) ── */}
      {!isEditing && (form.linkedin_url||form.github_url||form.handshake_url||form.portfolio_url||form.custom_links.length>0) && (
        <div className="pf-links-row stagger-3">
          {form.linkedin_url  && <a href={form.linkedin_url}  target="_blank" rel="noreferrer" className="pf-link-chip"><Linkedin size={14}/> LinkedIn <ExternalLink size={11}/></a>}
          {form.github_url    && <a href={form.github_url}    target="_blank" rel="noreferrer" className="pf-link-chip"><Github size={14}/> GitHub <ExternalLink size={11}/></a>}
          {form.handshake_url && <a href={form.handshake_url} target="_blank" rel="noreferrer" className="pf-link-chip"><Briefcase size={14}/> Handshake <ExternalLink size={11}/></a>}
          {form.portfolio_url && <a href={form.portfolio_url} target="_blank" rel="noreferrer" className="pf-link-chip"><Globe size={14}/> Portfolio <ExternalLink size={11}/></a>}
          {form.custom_links.filter(l=>l.url).map((l,i)=>(
            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="pf-link-chip">
              <Link2 size={14}/> {l.label||"Link"} <ExternalLink size={11}/>
            </a>
          ))}
        </div>
      )}

      {/* ── Edit form ── */}
      {isEditing && (
        <div className="pf-edit-section stagger-3">
          <div className="pf-tabs">
            {["personal","academic","links"].map(t=>(
              <button key={t}
                className={"pf-tab"+(activeTab===t?" active":"")}
                onClick={()=>setActiveTab(t)}>
                {t==="personal"?"👤 Personal":t==="academic"?"🎓 Academic":"🔗 Links"}
              </button>
            ))}
          </div>

          {activeTab==="personal" && (
            <div className="pf-form-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Display Name</label>
                  <input className="form-control" placeholder="Your full name"
                    value={form.display_name}
                    onChange={e=>setForm(f=>({...f,display_name:e.target.value}))}/>
                  <span className="pf-field-hint">Shows on dashboard and sidebar</span>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" value={user.email||""} disabled/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>University</label>
                  <input className="form-control" placeholder="e.g. University of Texas at Dallas"
                    value={form.university}
                    onChange={e=>setForm(f=>({...f,university:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>Major</label>
                  <input className="form-control" placeholder="e.g. Computer Science"
                    value={form.major}
                    onChange={e=>setForm(f=>({...f,major:e.target.value}))}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>School Year</label>
                  <select className="form-control" value={form.school_year}
                    onChange={e=>setForm(f=>({...f,school_year:e.target.value}))}>
                    {YEAR_OPTIONS.map(y=><option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Bio / Goals</label>
                <textarea className="form-control" rows={3}
                  placeholder="Career goals, interests…"
                  value={form.bio}
                  onChange={e=>setForm(f=>({...f,bio:e.target.value}))}/>
              </div>
            </div>
          )}

          {activeTab==="academic" && (
            <div className="pf-form-body">
              <div className="pf-academic-note">
                These values affect GPA Calculator and Degree Planner.
                Completed credits from archived classes are counted automatically —
                use the field below only for credits <em>before</em> you started using EduTrackr.
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Total Credits to Graduate</label>
                  <input type="number" className="form-control"
                    value={form.degree_credit_requirement}
                    onChange={e=>setForm(f=>({...f,degree_credit_requirement:e.target.value}))}/>
                  <span className="pf-field-hint">Most bachelor's degrees: 120–130 credits</span>
                </div>
                <div className="form-group">
                  <label>Prior Credits (before EduTrackr)</label>
                  <input type="number" className="form-control" min="0"
                    value={form.completed_credit_hours}
                    onChange={e=>setForm(f=>({...f,completed_credit_hours:e.target.value}))}/>
                  <span className="pf-field-hint">AP, transfer, dual-enrollment credits not tracked here</span>
                </div>
              </div>
              <div className="form-group" style={{maxWidth:"280px"}}>
                <label>Prior Cumulative GPA</label>
                <input type="number" step="0.01" min="0" max="4.3"
                  className="form-control"
                  placeholder="e.g. 3.50"
                  value={form.current_gpa}
                  onChange={e=>setForm(f=>({...f,current_gpa:e.target.value}))}/>
                <span className="pf-field-hint">GPA before archived classes — used as fallback</span>
              </div>

              {/* Live preview */}
              <div className="pf-academic-preview">
                <div className="pf-ap-item">
                  <span className="pf-ap-label">Estimated Cumulative GPA</span>
                  <span className="pf-ap-val" style={{color:gpaCol(stats.cumulativeGpa)}}>
                    {stats.cumulativeGpa ? Number(stats.cumulativeGpa).toFixed(2) : "—"}
                  </span>
                </div>
                <div className="pf-ap-item">
                  <span className="pf-ap-label">Credits Done (total)</span>
                  <span className="pf-ap-val">{stats.totalForDegree}</span>
                </div>
                <div className="pf-ap-item">
                  <span className="pf-ap-label">Completed (non-transfer)</span>
                  <span className="pf-ap-val">{stats.completedCredits}</span>
                </div>
                <div className="pf-ap-item">
                  <span className="pf-ap-label">Transfer</span>
                  <span className="pf-ap-val">{stats.transferCredits}</span>
                </div>
                <div className="pf-ap-item">
                  <span className="pf-ap-label">Degree Progress</span>
                  <span className="pf-ap-val">{stats.degreeProgress.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab==="links" && (
            <div className="pf-form-body">
              <div className="form-row">
                <div className="form-group">
                  <label><Linkedin size={13}/> LinkedIn</label>
                  <input type="url" className="form-control" placeholder="https://linkedin.com/in/…"
                    value={form.linkedin_url}
                    onChange={e=>setForm(f=>({...f,linkedin_url:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label><Github size={13}/> GitHub</label>
                  <input type="url" className="form-control" placeholder="https://github.com/…"
                    value={form.github_url}
                    onChange={e=>setForm(f=>({...f,github_url:e.target.value}))}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label><Briefcase size={13}/> Handshake</label>
                  <input type="url" className="form-control" placeholder="https://joinhandshake.com/…"
                    value={form.handshake_url}
                    onChange={e=>setForm(f=>({...f,handshake_url:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label><Globe size={13}/> Portfolio</label>
                  <input type="url" className="form-control" placeholder="https://yoursite.com"
                    value={form.portfolio_url}
                    onChange={e=>setForm(f=>({...f,portfolio_url:e.target.value}))}/>
                </div>
              </div>
              <div className="pf-custom-links">
                <div className="pf-cl-header">
                  <span className="pf-cl-title">Custom Links</span>
                  <button className="btn btn-ghost" style={{fontSize:"0.8rem"}} onClick={addLink}>
                    <Plus size={13}/> Add
                  </button>
                </div>
                {form.custom_links.map((link,i)=>(
                  <div key={i} className="pf-cl-row">
                    <input className="form-control pf-cl-label" placeholder="Label (e.g. Twitter)"
                      value={link.label} onChange={e=>updateLink(i,"label",e.target.value)}/>
                    <input type="url" className="form-control pf-cl-url" placeholder="https://…"
                      value={link.url} onChange={e=>updateLink(i,"url",e.target.value)}/>
                    <button className="btn-icon" onClick={()=>removeLink(i)}><Trash2 size={13}/></button>
                  </div>
                ))}
                {form.custom_links.length===0 && (
                  <p className="pf-cl-empty">No custom links yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Activity overview (view mode) ── */}
      {!isEditing && (
        <div className="pf-activity stagger-4">
          <div className="pf-activity-grid">

            <div className="pf-activity-card">
              <div className="pf-ac-header"><GraduationCap size={16}/><span>Degree Progress</span></div>
              <div className="pf-ac-body">
                <div className="pf-big-num" style={{color:"#ec4899"}}>
                  {stats.degreeProgress.toFixed(0)}%
                </div>
                <div className="pf-progress-bar">
                  <div style={{
                    width:stats.degreeProgress+"%", background:"#ec4899",
                    height:"100%", borderRadius:"3px", transition:"width 0.6s"
                  }}/>
                </div>
                <div className="pf-ac-sub">
                  {stats.totalForDegree} / {stats.degreeReq} credits
                  {stats.transferCredits > 0 && ` · ${stats.transferCredits} transferred`}
                </div>
              </div>
            </div>

            <div className="pf-activity-card">
              <div className="pf-ac-header"><TrendingUp size={16}/><span>GPA</span></div>
              <div className="pf-ac-body">
                <div className="pf-big-num" style={{color:gpaCol(stats.cumulativeGpa)}}>
                  {stats.cumulativeGpa ? Number(stats.cumulativeGpa).toFixed(2) : "—"}
                </div>
                <div className="pf-ac-sub">
                  {stats.archGpaCr > 0
                    ? `From ${stats.archGpaCr} graded non-transfer credits`
                    : "Archive classes with grades to track GPA"}
                </div>
              </div>
            </div>

            <div className="pf-activity-card">
              <div className="pf-ac-header"><FileText size={16}/><span>Assignments</span></div>
              <div className="pf-ac-body">
                <div className="pf-ac-split">
                  <div>
                    <span className="pf-ac-num">{pendingA.length}</span>
                    <span className="pf-ac-lbl">Pending</span>
                  </div>
                  <div>
                    <span className="pf-ac-num" style={{color:"#10b981"}}>{completedA.length}</span>
                    <span className="pf-ac-lbl">Done</span>
                  </div>
                  {overdueA.length>0 && (
                    <div>
                      <span className="pf-ac-num" style={{color:"#ef4444"}}>{overdueA.length}</span>
                      <span className="pf-ac-lbl">Overdue</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pf-activity-card">
              <div className="pf-ac-header"><Briefcase size={16}/><span>Career</span></div>
              <div className="pf-ac-body">
                <div className="pf-ac-split">
                  <div><span className="pf-ac-num">{applications.length}</span><span className="pf-ac-lbl">Applied</span></div>
                  <div>
                    <span className="pf-ac-num" style={{color:"#3b82f6"}}>
                      {applications.filter(a=>a.status==="Interview").length}
                    </span>
                    <span className="pf-ac-lbl">Interviews</span>
                  </div>
                  <div>
                    <span className="pf-ac-num" style={{color:"#10b981"}}>{offers.length}</span>
                    <span className="pf-ac-lbl">Offers</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pf-activity-card">
              <div className="pf-ac-header"><StickyNote size={16}/><span>Notes & Tasks</span></div>
              <div className="pf-ac-body">
                <div className="pf-ac-split">
                  <div><span className="pf-ac-num">{notes.length}</span><span className="pf-ac-lbl">Notes</span></div>
                  <div><span className="pf-ac-num">{todos.filter(t=>!t.is_completed).length}</span><span className="pf-ac-lbl">Active Tasks</span></div>
                  <div><span className="pf-ac-num" style={{color:"#10b981"}}>{todos.filter(t=>t.is_completed).length}</span><span className="pf-ac-lbl">Done</span></div>
                </div>
              </div>
            </div>

            <div className="pf-activity-card">
              <div className="pf-ac-header"><Calendar size={16}/><span>Today's Classes</span></div>
              <div className="pf-ac-body">
                {todayClasses.length===0
                  ? <div className="pf-ac-sub">No classes today 🎉</div>
                  : (
                    <div className="pf-today-classes">
                      {todayClasses.map(cls=>(
                        <div key={cls.id} className="pf-today-cls">
                          <span className="pf-today-dot" style={{background:cls.color}}/>
                          <span className="pf-today-code" style={{color:cls.color}}>{cls.course_code}</span>
                          <span className="pf-today-time">{cls.start_time}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
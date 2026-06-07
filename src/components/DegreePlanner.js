import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
  getDoc, setDoc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Trash2, Settings, ChevronDown, ChevronUp,
  GraduationCap, BookOpen, CheckCircle, Clock,
  TrendingUp, Layers, Map as MapIcon
} from "lucide-react";
import "../styles/DegreePlanner.css";

const STATUS_OPTIONS  = ["Not Started","In Progress","Completed","Transferred","Waived"];
const CATEGORY_OPTIONS = ["Core","Major","Minor","Elective","Graduate","Certificate"];

const STATUS_COLORS = {
  "Completed":   { bg:"rgb(254, 8, 8)",  text:"#000000",  border:"rgba(16,185,129,0.25)" },
  "Transferred": { bg:"rgb(255, 210, 8)",  text:"#000101",  border:"rgba(20,184,166,0.25)" },
  "In Progress": { bg:"rgb(5, 255, 13)",  text:"#000000",  border:"rgba(59,130,246,0.25)" },
  "Not Started": { bg:"rgb(3, 255, 171)", text:"#232323",  border:"rgba(255,255,255,0.1)" },
  "Waived":      { bg:"rgba(168,85,247,0.12)",  text:"#000000",  border:"rgba(168,85,247,0.25)" },
};

const DEFAULT_CORE_CATS = [
  { id:"010", name:"Communication",              credits:6 },
  { id:"020", name:"Mathematics",                credits:3 },
  { id:"030", name:"Life & Physical Sciences",   credits:6 },
  { id:"040", name:"Language, Philosophy & Culture", credits:3 },
  { id:"050", name:"Creative Arts",              credits:3 },
  { id:"060", name:"American History",           credits:6 },
  { id:"070", name:"Government / Political Science", credits:6 },
  { id:"080", name:"Social & Behavioral Sciences", credits:3 },
  { id:"090", name:"Component Area Option",      credits:6 },
];

const TABS = [
  { key:"overview",   label:"Overview",        Icon: TrendingUp  },
  { key:"semesters",  label:"Semesters",       Icon: Layers      },
  { key:"future",     label:"Plan Ahead",      Icon: MapIcon     },
  { key:"core",       label:"Core",            Icon: BookOpen    },
  { key:"major",      label:"Major",           Icon: GraduationCap },
  { key:"minor",      label:"Minor",           Icon: CheckCircle },
];

export default function DegreePlanner() {
  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [currentClasses, setCurrentClasses] = useState([]);
  const [semesters, setSemesters]     = useState([]);
  const [coreReqs, setCoreReqs]       = useState([]);
  const [majorReqs, setMajorReqs]     = useState([]);
  const [minorReqs, setMinorReqs]     = useState([]);
  const [degreeSettings, setDegreeSettings] = useState({
    totalCredits: 120, minorName:"Minor",
    minorCredits: 18, coreCategories: DEFAULT_CORE_CATS,
  });
  const [activeTab, setActiveTab]     = useState("overview");
  const [expandedSems, setExpandedSems] = useState({});

  /* Modals */
  const [semModal,     setSemModal]     = useState(false);
  const [courseModal,  setCourseModal]  = useState(null); // semesterId or "future"
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, semId? }
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reqModal,     setReqModal]     = useState(null); // "core" | "major" | "minor"

  const [semName, setSemName]   = useState("");
  const [courseForm, setCourseForm] = useState({
    course_code:"", course_name:"", credit_hours:3,
    category:"Major", core_category:"", status:"Not Started", notes:""
  });
  const [reqForm, setReqForm] = useState({
    course_code:"", course_name:"", credit_hours:3,
    core_category:"", status:"Not Started"
  });

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

    subs.push(onSnapshot(doc(db,"users",uid), s => {
      if (s.exists()) setProfile(s.data());
    }));

    const loadSettings = async () => {
      const snap = await getDoc(doc(db,"degreeSettings",uid));
      if (snap.exists()) {
        setDegreeSettings(prev => ({ ...prev, ...snap.data() }));
      }
    };
    loadSettings();

    subs.push(onSnapshot(
      query(collection(db,"classes"), where("uid","==",uid), where("is_active","==",true)),
      s => setCurrentClasses(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"degreeSemesters"), where("uid","==",uid)),
      s => setSemesters(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0)))
    ));
    subs.push(onSnapshot(
      query(collection(db,"coreRequirements"), where("uid","==",uid)),
      s => setCoreReqs(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"majorRequirements"), where("uid","==",uid)),
      s => setMajorReqs(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"minorRequirements"), where("uid","==",uid)),
      s => setMinorReqs(s.docs.map(d=>({id:d.id,...d.data()})))
    ));

    return () => subs.forEach(u => u());
  }, [user]);

  /* Auto-expand first semester */
  useEffect(() => {
    if (semesters.length && Object.keys(expandedSems).length === 0) {
      setExpandedSems({ [semesters[0].id]: true });
    }
  }, [semesters]);

  /* ── Progress calculations ── */
  const progress = useMemo(() => {
    const req = Number(profile?.degree_credit_requirement || degreeSettings.totalCredits || 120);
    const done = new Map();
    const addCredit = (code, cr) => { if (!done.has(code)) done.set(code, Number(cr)||0); };

    // From requirement collections
    [...coreReqs,...majorReqs,...minorReqs].forEach(c => {
      if (c.status==="Completed"||c.status==="Transferred"||c.is_completed)
        addCredit(c.course_code+"-req", c.credit_hours);
    });
    // From planned semesters
    semesters.forEach(s => (s.courses||[]).forEach(c => {
      if (c.status==="Completed"||c.status==="Transferred")
        addCredit(c.course_code+"-sem-"+s.id, c.credit_hours);
    }));
    // In progress
    const inProg = new Map();
    currentClasses.forEach(c => {
      if (!inProg.has(c.course_code)) inProg.set(c.course_code, Number(c.credit_hours)||0);
    });
    semesters.forEach(s => (s.courses||[]).forEach(c => {
      if (c.status==="In Progress") inProg.set(c.course_code+s.id, Number(c.credit_hours)||0);
    }));

    const completedCr = Array.from(done.values()).reduce((a,b)=>a+b,0);
    const profileXfer = Number(profile?.completed_credit_hours||0);
    const transferred = profileXfer;
    const combined    = completedCr + transferred;
    const inProgCr    = Array.from(inProg.values()).reduce((a,b)=>a+b,0);
    const remaining   = Math.max(0, req - combined - inProgCr);
    return {
      completedCr, transferred, combined, inProgCr, remaining,
      req, pct: Math.min((combined/req)*100,100)
    };
  }, [coreReqs, majorReqs, minorReqs, semesters, currentClasses, profile, degreeSettings]);

  /* Core category helpers */
  const coreCats = degreeSettings.coreCategories || DEFAULT_CORE_CATS;
  const getCoreForCat = catName => {
    const fromCurrent  = currentClasses.filter(c=>c.category==="Core"&&c.core_category===catName).map(c=>({...c,source:"current"}));
    const fromManual   = coreReqs.filter(c=>c.category===catName).map(c=>({...c,source:"manual"}));
    const fromSems     = semesters.flatMap(s=>(s.courses||[]).filter(c=>c.category==="Core"&&c.core_category===catName).map(c=>({...c,source:"semester",semName:s.name})));
    return [...fromCurrent,...fromManual,...fromSems];
  };

  const getMajorCourses = () => {
    const fromCurrent = currentClasses.filter(c=>c.category==="Major").map(c=>({...c,source:"current"}));
    const fromManual  = majorReqs.map(c=>({...c,source:"manual"}));
    const fromSems    = semesters.flatMap(s=>(s.courses||[]).filter(c=>c.category==="Major").map(c=>({...c,source:"semester",semName:s.name})));
    return [...fromCurrent,...fromManual,...fromSems];
  };

  const getMinorCourses = () => {
    const fromCurrent = currentClasses.filter(c=>c.category==="Minor").map(c=>({...c,source:"current"}));
    const fromManual  = minorReqs.map(c=>({...c,source:"manual"}));
    const fromSems    = semesters.flatMap(s=>(s.courses||[]).filter(c=>c.category==="Minor").map(c=>({...c,source:"semester",semName:s.name})));
    return [...fromCurrent,...fromManual,...fromSems];
  };

  /* Future courses = semester courses with status Not Started */
  const futureCourses = useMemo(() =>
    semesters.flatMap(s =>
      (s.courses||[]).filter(c=>c.status==="Not Started"||c.status==="In Progress")
        .map(c=>({...c,semName:s.name,semId:s.id}))
    )
  , [semesters]);

  /* ── Save settings ── */
  const saveSettings = async (updated) => {
    const merged = { ...degreeSettings, ...updated };
    setDegreeSettings(merged);
    await setDoc(doc(db,"degreeSettings",user.uid), merged, {merge:true});
  };

  /* ── Semester CRUD ── */
  const addSemester = async e => {
    e.preventDefault();
    if (!semName.trim()) return;
    const newDoc = await addDoc(collection(db,"degreeSemesters"),{
      name:semName.trim(), uid:user.uid, courses:[], order:semesters.length+1
    });
    setExpandedSems(p=>({...p,[newDoc.id]:true}));
    setSemModal(false); setSemName("");
  };

  const deleteSemester = async id => {
    await deleteDoc(doc(db,"degreeSemesters",id));
    setDeleteTarget(null);
  };

  /* ── Course in semester CRUD ── */
  const addCourseToSemester = async e => {
    e.preventDefault();
    const semId = courseModal;
    if (!semId || semId==="future") return;
    const sem = semesters.find(s=>s.id===semId);
    if (!sem) return;
    const newCourse = { ...courseForm, id: Date.now().toString() };
    await updateDoc(doc(db,"degreeSemesters",semId),{
      courses:[...(sem.courses||[]),newCourse]
    });
    setCourseModal(null);
    setCourseForm({course_code:"",course_name:"",credit_hours:3,category:"Major",core_category:"",status:"Not Started",notes:""});
  };

  const updateSemCourse = async (semId, courseId, field, value) => {
    const sem = semesters.find(s=>s.id===semId);
    if (!sem) return;
    await updateDoc(doc(db,"degreeSemesters",semId),{
      courses: sem.courses.map(c => c.id===courseId ? {...c,[field]:value} : c)
    });
  };

  const deleteSemCourse = async (semId, courseId) => {
    const sem = semesters.find(s=>s.id===semId);
    if (!sem) return;
    await updateDoc(doc(db,"degreeSemesters",semId),{
      courses: sem.courses.filter(c=>c.id!==courseId)
    });
    setDeleteTarget(null);
  };

  /* ── Requirement CRUD ── */
  const addRequirement = async e => {
    e.preventDefault();
    const colName = reqModal==="core"?"coreRequirements": reqModal==="major"?"majorRequirements":"minorRequirements";
    await addDoc(collection(db,colName),{
      ...reqForm,
      category: reqModal==="core" ? reqForm.core_category : (reqModal==="major"?"Major":"Minor"),
      uid:user.uid
    });
    setReqModal(null);
    setReqForm({course_code:"",course_name:"",credit_hours:3,core_category:"",status:"Not Started"});
  };

  const updateReq = async (type, id, field, value) => {
    const col = type==="core"?"coreRequirements": type==="major"?"majorRequirements":"minorRequirements";
    await updateDoc(doc(db,col,id),{[field]:value});
  };

  const deleteReq = async (type, id) => {
    const col = type==="core"?"coreRequirements": type==="major"?"majorRequirements":"minorRequirements";
    await deleteDoc(doc(db,col,id));
    setDeleteTarget(null);
  };

  /* ── Helpers ── */
  const statusPill = (status) => {
    const s = STATUS_COLORS[status] || STATUS_COLORS["Not Started"];
    return (
      <span className="dp-status-pill" style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`}}>
        {status}
      </span>
    );
  };

  const semesterCredits = sem =>
    (sem.courses||[]).reduce((s,c)=>s+Number(c.credit_hours||0),0);

  if (!user) return <div className="dp-signin">Please sign in to view Degree Planner</div>;

  return (
    <div className="degree-planner">
      {/* ── Header ── */}
      <div className="dp-header">
        <div>
          <h1>Degree Planner</h1>
          <p>Plan your full academic journey from now to graduation</p>
        </div>
        <button className="btn btn-ghost" onClick={()=>setSettingsOpen(true)}>
          <Settings size={16}/> Settings
        </button>
      </div>

      {/* ── Progress Hero ── */}
      <div className="dp-progress-hero stagger-1">
        <div className="dp-progress-stats">
          <div className="dp-pstat">
            <span className="dp-pstat-val">{progress.combined}</span>
            <span className="dp-pstat-label">Completed cr.</span>
          </div>
          <div className="dp-pstat blue">
            <span className="dp-pstat-val">{progress.inProgCr}</span>
            <span className="dp-pstat-label">In Progress</span>
          </div>
          <div className="dp-pstat amber">
            <span className="dp-pstat-val">{progress.remaining}</span>
            <span className="dp-pstat-label">Remaining</span>
          </div>
          <div className="dp-pstat teal">
            <span className="dp-pstat-val">{progress.transferred}</span>
            <span className="dp-pstat-label">Transferred</span>
          </div>
        </div>
        <div className="dp-progress-bar-wrap">
          <div className="dp-progress-labels">
            <span>{progress.combined}/{progress.req} credits</span>
            <span className="dp-pct">{progress.pct.toFixed(1)}%</span>
          </div>
          <div className="dp-progress-track">
            <div className="dp-progress-fill" style={{width:`${progress.pct}%`}}/>
            {progress.inProgCr > 0 && (
              <div className="dp-progress-inprog" style={{
                width:`${Math.min((progress.inProgCr/progress.req)*100,100-(progress.pct))}%`,
                left:`${progress.pct}%`
              }}/>
            )}
          </div>
          <div className="dp-progress-legend">
            <span className="dp-leg green">Completed</span>
            <span className="dp-leg blue">In Progress</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="dp-tabs stagger-2">
        {TABS.map(t => {
          const Icon = t.Icon;
          return (
            <button
              key={t.key}
              className={"dp-tab"+(activeTab===t.key?" active":"")}
              onClick={()=>setActiveTab(t.key)}
            >
              <Icon size={15}/> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
      {activeTab==="overview" && (
        <div className="dp-tab-content stagger-3">
          <div className="dp-overview-grid">

            {/* Current semester */}
            {currentClasses.length > 0 && (
              <div className="dp-overview-card">
                <div className="dp-ov-header">
                  <Clock size={15}/>
                  <span>Current Semester</span>
                  <span className="dp-ov-cr">
                    {currentClasses.reduce((s,c)=>s+Number(c.credit_hours||0),0)} cr
                  </span>
                </div>
                <div className="dp-course-table">
                  {currentClasses.map(cls=>(
                    <div key={cls.id} className="dp-course-row current-row">
                      <span className="dp-cr-code" style={{color:cls.color}}>{cls.course_code}</span>
                      <span className="dp-cr-name">{cls.course_name}</span>
                      <span className="dp-cr-hrs">{cls.credit_hours}cr</span>
                      {statusPill("In Progress")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming semesters */}
            {semesters.filter(s=>(s.courses||[]).some(c=>c.status==="Not Started"||c.status==="In Progress")).slice(0,3).map(sem=>(
              <div key={sem.id} className="dp-overview-card">
                <div className="dp-ov-header">
                  <Layers size={15}/>
                  <span>{sem.name}</span>
                  <span className="dp-ov-cr">{semesterCredits(sem)} cr</span>
                </div>
                <div className="dp-course-table">
                  {(sem.courses||[]).filter(c=>c.status!=="Completed"&&c.status!=="Transferred").map(c=>(
                    <div key={c.id} className="dp-course-row">
                      <span className="dp-cr-code">{c.course_code}</span>
                      <span className="dp-cr-name">{c.course_name}</span>
                      <span className="dp-cr-hrs">{c.credit_hours}cr</span>
                      {statusPill(c.status)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ SEMESTERS TAB ═══════════════ */}
      {activeTab==="semesters" && (
        <div className="dp-tab-content stagger-3">
          <div className="dp-section-actions">
            <h3 className="dp-section-title">Planned Semesters</h3>
            <button className="btn btn-primary" onClick={()=>setSemModal(true)}>
              <Plus size={14}/> Add Semester
            </button>
          </div>

          {/* Current classes block */}
          {currentClasses.length > 0 && (
            <div className="dp-semester-block current-sem">
              <div className="dp-sem-header">
                <div className="dp-sem-left">
                  <span className="dp-sem-badge current-badge">CURRENT</span>
                  <span className="dp-sem-name">This Semester</span>
                </div>
                <span className="dp-sem-cr">
                  {currentClasses.reduce((s,c)=>s+Number(c.credit_hours||0),0)} credits
                </span>
              </div>
              <div className="dp-course-table dp-table-full">
                <div className="dp-table-head">
                  <span>Code</span><span>Name</span><span>Cr</span>
                  <span>Category</span><span>Status</span>
                </div>
                {currentClasses.map(cls=>(
                  <div key={cls.id} className="dp-course-row">
                    <span className="dp-cr-code" style={{color:cls.color}}>{cls.course_code}</span>
                    <span className="dp-cr-name">{cls.course_name}</span>
                    <span className="dp-cr-hrs">{cls.credit_hours}</span>
                    <span className="dp-cr-cat">{cls.category||"Major"}</span>
                    {statusPill("In Progress")}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planned semesters */}
          {semesters.map(sem=>{
            const isOpen = expandedSems[sem.id] !== false;
            const cr     = semesterCredits(sem);
            const done   = (sem.courses||[]).filter(c=>c.status==="Completed"||c.status==="Transferred").length;
            const total  = (sem.courses||[]).length;
            return (
              <div key={sem.id} className="dp-semester-block">
                <button
                  className="dp-sem-header dp-sem-toggle"
                  onClick={()=>setExpandedSems(p=>({...p,[sem.id]:!p[sem.id]}))}
                >
                  <div className="dp-sem-left">
                    <span className="dp-sem-name">{sem.name}</span>
                    {total>0 && (
                      <span className="dp-sem-progress-mini">
                        {done}/{total} done
                      </span>
                    )}
                  </div>
                  <div className="dp-sem-right">
                    <span className="dp-sem-cr">{cr} cr</span>
                    <button
                      className="btn-icon dp-del-sem"
                      onClick={e=>{e.stopPropagation();setDeleteTarget({type:"semester",id:sem.id});}}
                    >
                      <Trash2 size={13}/>
                    </button>
                    {isOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </div>
                </button>

                {isOpen && (
                  <div className="dp-sem-body">
                    {total > 0 ? (
                      <div className="dp-course-table dp-table-editable">
                        <div className="dp-table-head">
                          <span>Code</span><span>Name</span><span>Cr</span>
                          <span>Status</span><span>Category</span><span></span>
                        </div>
                        {(sem.courses||[]).map(c=>(
                          <div key={c.id} className={"dp-course-row editable-row"+(c.status==="Completed"?" row-done":"")}>
                            <input className="dp-cell-input"
                              value={c.course_code}
                              onChange={e=>updateSemCourse(sem.id,c.id,"course_code",e.target.value)}/>
                            <input className="dp-cell-input wide"
                              value={c.course_name}
                              onChange={e=>updateSemCourse(sem.id,c.id,"course_name",e.target.value)}/>
                            <input className="dp-cell-input narrow" type="number"
                              value={c.credit_hours}
                              onChange={e=>updateSemCourse(sem.id,c.id,"credit_hours",Number(e.target.value))}/>
                            <select className="dp-cell-select"
                              value={c.status}
                              onChange={e=>updateSemCourse(sem.id,c.id,"status",e.target.value)}
                              style={{color: STATUS_COLORS[c.status]?.text||"inherit"}}>
                              {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                            </select>
                            <select className="dp-cell-select"
                              value={c.category}
                              onChange={e=>updateSemCourse(sem.id,c.id,"category",e.target.value)}>
                              {CATEGORY_OPTIONS.map(c=><option key={c}>{c}</option>)}
                            </select>
                            <button className="btn-icon dp-del-course"
                              onClick={()=>setDeleteTarget({type:"semCourse",semId:sem.id,courseId:c.id})}>
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="dp-empty-hint">No courses added yet</p>
                    )}
                    <button className="dp-add-course-btn"
                      onClick={()=>setCourseModal(sem.id)}>
                      <Plus size={13}/> Add Course
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {semesters.length===0 && currentClasses.length===0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <h3>No semesters planned</h3>
              <p>Add a semester to start planning your degree</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ PLAN AHEAD TAB ═══════════════ */}
      {activeTab==="future" && (
        <div className="dp-tab-content stagger-3">
          <div className="dp-section-actions">
            <h3 className="dp-section-title">Future Course Pipeline</h3>
            <p className="dp-section-sub">Courses marked "Not Started" across your planned semesters</p>
          </div>
          {futureCourses.length===0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🗺️</div>
              <h3>No future courses planned</h3>
              <p>Add semesters and mark courses "Not Started" to see them here</p>
            </div>
          ) : (
            <div className="dp-future-grid">
              {/* Group by semester */}
              {Object.entries(
                futureCourses.reduce((acc,c)=>{
                  if(!acc[c.semName]) acc[c.semName]=[];
                  acc[c.semName].push(c); return acc;
                },{})
              ).map(([semName,courses])=>(
                <div key={semName} className="dp-future-group">
                  <div className="dp-future-sem-label">
                    <Layers size={13}/>
                    <span>{semName}</span>
                    <span className="dp-future-cr">
                      {courses.reduce((s,c)=>s+Number(c.credit_hours||0),0)} cr
                    </span>
                  </div>
                  {courses.map(c=>(
                    <div key={c.id} className="dp-future-course">
                      <div className="dp-future-left">
                        <span className="dp-cr-code">{c.course_code}</span>
                        <span className="dp-cr-name">{c.course_name}</span>
                      </div>
                      <div className="dp-future-right">
                        <span className="dp-cr-hrs">{c.credit_hours}cr</span>
                        {statusPill(c.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ CORE TAB ═══════════════ */}
      {activeTab==="core" && (
        <div className="dp-tab-content stagger-3">
          <div className="dp-section-actions">
            <h3 className="dp-section-title">Core Curriculum</h3>
            <button className="btn btn-primary" onClick={()=>setReqModal("core")}>
              <Plus size={14}/> Add Core Course
            </button>
          </div>
          <div className="dp-core-grid">
            {coreCats.map(cat=>{
              const courses = getCoreForCat(cat.name);
              const earned  = courses.filter(c=>c.source==="current"||c.status==="Completed"||c.status==="Transferred")
                .reduce((s,c)=>s+Number(c.credit_hours||0),0);
              const pct     = Math.min((earned/cat.credits)*100,100);
              const done    = earned >= cat.credits;
              return (
                <div key={cat.id} className={"dp-core-cat"+(done?" cat-done":"")}>
                  <div className="dp-core-cat-header">
                    <div className="dp-core-cat-info">
                      <span className="dp-core-cat-id">{cat.id}</span>
                      <span className="dp-core-cat-name">{cat.name}</span>
                    </div>
                    <div className="dp-core-cat-cr">
                      <span style={{color:done?"#34d399":"var(--text-secondary)"}}>{earned}</span>
                      <span style={{color:"var(--text-muted)"}}>/{cat.credits} cr</span>
                    </div>
                  </div>
                  <div className="dp-mini-progress">
                    <div className="dp-mini-bar" style={{width:pct+"%", background:done?"#10b981":"#3b82f6"}}/>
                  </div>
                  {courses.length > 0 && (
                    <div className="dp-core-courses">
                      {courses.map((c,i)=>(
                        <div key={i} className="dp-core-course-row">
                          <span className="dp-cr-code">{c.course_code}</span>
                          <span className="dp-cr-name">{c.course_name}</span>
                          <span className="dp-cr-hrs">{c.credit_hours}cr</span>
                          {c.source==="current"
                            ? statusPill("In Progress")
                            : c.source==="semester"
                              ? <span className="dp-sem-tag">{c.semName}</span>
                              : (
                                <>
                                  <select className="dp-cell-select"
                                    value={c.status||"Not Started"}
                                    onChange={e=>updateReq("core",c.id,"status",e.target.value)}
                                    style={{color:STATUS_COLORS[c.status]?.text||"inherit"}}>
                                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                                  </select>
                                  <button className="btn-icon dp-del-course"
                                    onClick={()=>setDeleteTarget({type:"core",id:c.id})}>
                                    <Trash2 size={12}/>
                                  </button>
                                </>
                              )
                          }
                        </div>
                      ))}
                    </div>
                  )}
                  {courses.length===0 && <p className="dp-empty-hint">No courses yet</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ MAJOR TAB ═══════════════ */}
      {activeTab==="major" && (
        <div className="dp-tab-content stagger-3">
          <div className="dp-section-actions">
            <h3 className="dp-section-title">Major Requirements</h3>
            <button className="btn btn-primary" onClick={()=>setReqModal("major")}>
              <Plus size={14}/> Add Course
            </button>
          </div>
          {getMajorCourses().length===0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📖</div>
              <h3>No major courses yet</h3>
            </div>
          ) : (
            <div className="dp-req-table">
              <div className="dp-table-head">
                <span>Code</span><span>Name</span><span>Cr</span><span>Status</span><span></span>
              </div>
              {getMajorCourses().map((c,i)=>(
                <div key={i} className={"dp-course-row"+(c.status==="Completed"?" row-done":"")}>
                  <span className="dp-cr-code">{c.course_code}</span>
                  <span className="dp-cr-name">{c.course_name}</span>
                  <span className="dp-cr-hrs">{c.credit_hours}cr</span>
                  {c.source==="current"
                    ? statusPill("In Progress")
                    : c.source==="semester"
                      ? <span className="dp-sem-tag">{c.semName}</span>
                      : (
                        <>
                          <select className="dp-cell-select"
                            value={c.status||"Not Started"}
                            onChange={e=>updateReq("major",c.id,"status",e.target.value)}
                            style={{color:STATUS_COLORS[c.status]?.text||"inherit"}}>
                            {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                          </select>
                          <button className="btn-icon dp-del-course"
                            onClick={()=>setDeleteTarget({type:"major",id:c.id})}>
                            <Trash2 size={12}/>
                          </button>
                        </>
                      )
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ MINOR TAB ═══════════════ */}
      {activeTab==="minor" && (
        <div className="dp-tab-content stagger-3">
          <div className="dp-section-actions">
            <h3 className="dp-section-title">{degreeSettings.minorName||"Minor"} Requirements</h3>
            <button className="btn btn-primary" onClick={()=>setReqModal("minor")}>
              <Plus size={14}/> Add Course
            </button>
          </div>
          {/* Minor progress */}
          <div className="dp-minor-progress">
            <div className="dp-minor-prog-row">
              <span>Progress</span>
              <span>{getMinorCourses().filter(c=>c.status==="Completed"||c.is_completed).reduce((s,c)=>s+Number(c.credit_hours||0),0)}/{degreeSettings.minorCredits||18} cr</span>
            </div>
            <div className="dp-mini-progress">
              <div className="dp-mini-bar teal" style={{
                width: Math.min(
                  (getMinorCourses().filter(c=>c.status==="Completed"||c.is_completed).reduce((s,c)=>s+Number(c.credit_hours||0),0)
                    / (degreeSettings.minorCredits||18))*100, 100
                )+"%"
              }}/>
            </div>
          </div>
          {getMinorCourses().length===0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No minor courses yet</h3>
            </div>
          ) : (
            <div className="dp-req-table">
              <div className="dp-table-head">
                <span>Code</span><span>Name</span><span>Cr</span><span>Status</span><span></span>
              </div>
              {getMinorCourses().map((c,i)=>(
                <div key={i} className={"dp-course-row"+(c.status==="Completed"?" row-done":"")}>
                  <span className="dp-cr-code">{c.course_code}</span>
                  <span className="dp-cr-name">{c.course_name}</span>
                  <span className="dp-cr-hrs">{c.credit_hours}cr</span>
                  {c.source==="current"
                    ? statusPill("In Progress")
                    : c.source==="semester"
                      ? <span className="dp-sem-tag">{c.semName}</span>
                      : (
                        <>
                          <select className="dp-cell-select"
                            value={c.status||"Not Started"}
                            onChange={e=>updateReq("minor",c.id,"status",e.target.value)}
                            style={{color:STATUS_COLORS[c.status]?.text||"inherit"}}>
                            {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                          </select>
                          <button className="btn-icon dp-del-course"
                            onClick={()=>setDeleteTarget({type:"minor",id:c.id})}>
                            <Trash2 size={12}/>
                          </button>
                        </>
                      )
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ADD SEMESTER MODAL ══════════════ */}
      {semModal && (
        <div className="modal-overlay" onClick={()=>setSemModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Semester</h2>
              <button className="btn-icon" onClick={()=>setSemModal(false)}>✕</button>
            </div>
            <form onSubmit={addSemester}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Semester Name *</label>
                  <input className="form-control" placeholder="e.g. Fall 2025"
                    value={semName} onChange={e=>setSemName(e.target.value)} required autoFocus/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setSemModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Semester</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ ADD COURSE TO SEMESTER MODAL ══════════════ */}
      {courseModal && (
        <div className="modal-overlay" onClick={()=>setCourseModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Course</h2>
              <button className="btn-icon" onClick={()=>setCourseModal(null)}>✕</button>
            </div>
            <form onSubmit={addCourseToSemester}>
              <div className="modal-body dp-course-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Course Code *</label>
                    <input className="form-control" placeholder="CS 3345"
                      value={courseForm.course_code}
                      onChange={e=>setCourseForm(f=>({...f,course_code:e.target.value}))} required/>
                  </div>
                  <div className="form-group">
                    <label>Credit Hours</label>
                    <input type="number" min="0" max="12" className="form-control"
                      value={courseForm.credit_hours}
                      onChange={e=>setCourseForm(f=>({...f,credit_hours:Number(e.target.value)}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Course Name *</label>
                  <input className="form-control" placeholder="Data Structures"
                    value={courseForm.course_name}
                    onChange={e=>setCourseForm(f=>({...f,course_name:e.target.value}))} required/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-control" value={courseForm.category}
                      onChange={e=>setCourseForm(f=>({...f,category:e.target.value}))}>
                      {CATEGORY_OPTIONS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select className="form-control" value={courseForm.status}
                      onChange={e=>setCourseForm(f=>({...f,status:e.target.value}))}>
                      {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {courseForm.category==="Core" && (
                  <div className="form-group">
                    <label>Core Category</label>
                    <select className="form-control" value={courseForm.core_category}
                      onChange={e=>setCourseForm(f=>({...f,core_category:e.target.value}))}>
                      <option value="">— Select —</option>
                      {coreCats.map(cat=><option key={cat.id} value={cat.name}>{cat.id} {cat.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setCourseModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ ADD REQUIREMENT MODAL ══════════════ */}
      {reqModal && (
        <div className="modal-overlay" onClick={()=>setReqModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add {reqModal==="core"?"Core":reqModal==="major"?"Major":"Minor"} Course</h2>
              <button className="btn-icon" onClick={()=>setReqModal(null)}>✕</button>
            </div>
            <form onSubmit={addRequirement}>
              <div className="modal-body dp-course-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Course Code *</label>
                    <input className="form-control" placeholder="e.g. COMM 1301"
                      value={reqForm.course_code}
                      onChange={e=>setReqForm(f=>({...f,course_code:e.target.value}))} required/>
                  </div>
                  <div className="form-group">
                    <label>Credits</label>
                    <input type="number" min="0" className="form-control"
                      value={reqForm.credit_hours}
                      onChange={e=>setReqForm(f=>({...f,credit_hours:Number(e.target.value)}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Course Name *</label>
                  <input className="form-control" placeholder="Course name"
                    value={reqForm.course_name}
                    onChange={e=>setReqForm(f=>({...f,course_name:e.target.value}))} required/>
                </div>
                {reqModal==="core" && (
                  <div className="form-group">
                    <label>Core Category *</label>
                    <select className="form-control" value={reqForm.core_category}
                      onChange={e=>setReqForm(f=>({...f,core_category:e.target.value}))} required>
                      <option value="">— Select —</option>
                      {coreCats.map(cat=><option key={cat.id} value={cat.name}>{cat.id} {cat.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={reqForm.status}
                    onChange={e=>setReqForm(f=>({...f,status:e.target.value}))}>
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setReqModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ SETTINGS MODAL ══════════════ */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={()=>setSettingsOpen(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Degree Settings</h2>
              <button className="btn-icon" onClick={()=>setSettingsOpen(false)}>✕</button>
            </div>
            <div className="modal-body dp-settings-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Total Credits Required</label>
                  <input type="number" className="form-control"
                    value={degreeSettings.totalCredits||120}
                    onChange={e=>saveSettings({totalCredits:Number(e.target.value)})}/>
                </div>
                <div className="form-group">
                  <label>Minor Credits Required</label>
                  <input type="number" className="form-control"
                    value={degreeSettings.minorCredits||18}
                    onChange={e=>saveSettings({minorCredits:Number(e.target.value)})}/>
                </div>
              </div>
              <div className="form-group">
                <label>Minor Name</label>
                <input className="form-control" placeholder="e.g. Business Administration"
                  value={degreeSettings.minorName||""}
                  onChange={e=>saveSettings({minorName:e.target.value})}/>
              </div>
              <div className="dp-settings-note">
                Changes save automatically. Your degree progress will update in real time.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={()=>setSettingsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ DELETE CONFIRM ══════════════ */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-body" style={{textAlign:"center",padding:"2rem 1.5rem"}}>
              <div className="delete-modal-icon">🗑️</div>
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>
                {deleteTarget.type==="semester" ? "Delete Semester?" : "Remove Course?"}
              </h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>
                {deleteTarget.type==="semester"
                  ? "This will remove the semester and all its planned courses."
                  : "This will remove the course from your planner."
                } This cannot be undone.
              </p>
            </div>
            <div className="modal-footer" style={{justifyContent:"center"}}>
              <button className="btn btn-secondary" onClick={()=>setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>{
                if (deleteTarget.type==="semester")    deleteSemester(deleteTarget.id);
                else if (deleteTarget.type==="semCourse") deleteSemCourse(deleteTarget.semId,deleteTarget.courseId);
                else deleteReq(deleteTarget.type, deleteTarget.id);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
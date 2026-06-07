import React, { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Archive, RotateCcw, Trash2, Edit2,
  Clock, User, BookOpen, Calendar,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle
} from "lucide-react";
import "../styles/Classes.css";

const PRESET_COLORS = [
  "#3B82F6","#10B981","#F59E0B","#EF4444","#06B6D4",
  "#6366F1","#84CC16","#A855F7","#F43F5E","#FACC15",
  "#FB923C","#2DD4BF","#818CF8","#34D399","#FCA5A5",
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const CATEGORY_OPTIONS = ["Major","Core","Minor","Elective","Graduate","Certificate"];
const SEMESTER_PRESETS = [
  "Fall 2024","Spring 2025","Summer 2025",
  "Fall 2025","Spring 2026","Summer 2026","Fall 2026",
];

/* Default grading scale rows */
const DEFAULT_SCALE = [
  { letter:"A+", min:97, max:100, gpaValue:4.0  },
  { letter:"A",  min:93, max:96.9, gpaValue:4.0  },
  { letter:"A-", min:90, max:92.9, gpaValue:3.67 },
  { letter:"B+", min:87, max:89.9, gpaValue:3.33 },
  { letter:"B",  min:83, max:86.9, gpaValue:3.0  },
  { letter:"B-", min:80, max:82.9, gpaValue:2.67 },
  { letter:"C+", min:77, max:79.9, gpaValue:2.33 },
  { letter:"C",  min:73, max:76.9, gpaValue:2.0  },
  { letter:"C-", min:70, max:72.9, gpaValue:1.67 },
  { letter:"D+", min:67, max:69.9, gpaValue:1.33 },
  { letter:"D",  min:63, max:66.9, gpaValue:1.0  },
  { letter:"D-", min:60, max:62.9, gpaValue:0.67 },
  { letter:"F",  min:0,  max:59.99, gpaValue:0.0  },
];

/* ── GPA verification helper ── */
const calcClassGpa = (gradeScale, earnedPct) => {
  if (!gradeScale || !earnedPct) return null;
  for (const row of gradeScale) {
    if (earnedPct >= row.min && earnedPct <= row.max) {
      return row.gpaValue ?? null;
    }
  }
  return null;
};

export default function Classes() {
  const [user, setUser]               = useState(null);
  const [classes, setClasses]         = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("info"); // info | schedule | scale
  const [saving, setSaving]           = useState(false);

  /* GPA verification modal */
  const [gpaVerifyModal, setGpaVerifyModal] = useState(null);
  // { cls, calculatedGpa, currentStoredGpa }

  const blankForm = {
    course_code:"", course_name:"", professor:"",
    credit_hours:3, days:[], start_time:"", end_time:"",
    color: PRESET_COLORS[Math.floor(Math.random()*PRESET_COLORS.length)],
    semester:"", category:"Major", core_category:"",
    room_number:"", is_active:true,
    /* Per-class grading scale */
    grading_scale: DEFAULT_SCALE.map(r=>({...r})),
    /* Stored final grade (filled when archiving) */
    final_grade_pct: "",
    final_letter: "",
  };
  const [form, setForm] = useState(blankForm);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  /* ── Firestore ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,"classes"), where("uid","==",user.uid));
    const unsub = onSnapshot(q, snap =>
      setClasses(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    return () => unsub();
  }, [user]);

  /* ── Helpers ── */
  const openAdd = () => {
    setForm({ ...blankForm, color:PRESET_COLORS[Math.floor(Math.random()*PRESET_COLORS.length)], grading_scale:DEFAULT_SCALE.map(r=>({...r})) });
    setEditingClass(null);
    setActiveFormTab("info");
    setIsModalOpen(true);
    setShowColorPicker(false);
  };

  const openEdit = cls => {
    setEditingClass(cls);
    setForm({
      ...blankForm,
      ...cls,
      grading_scale: cls.grading_scale || DEFAULT_SCALE.map(r=>({...r})),
    });
    setActiveFormTab("info");
    setIsModalOpen(true);
    setShowColorPicker(false);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingClass(null); };

  const toggleDay = day =>
    setForm(f=>({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d=>d!==day) : [...f.days,day]
    }));

  /* ── Scale row helpers ── */
  const updateScaleRow = (idx, field, value) => {
    const scale = form.grading_scale.map((r,i) =>
      i===idx ? { ...r, [field]: field==="letter" ? value : Number(value) } : r
    );
    setForm(f=>({...f, grading_scale:scale}));
  };

  const addScaleRow = () =>
    setForm(f=>({...f, grading_scale:[...f.grading_scale,{letter:"",min:0,max:0,gpaValue:0}]}));

  const removeScaleRow = idx =>
    setForm(f=>({...f, grading_scale:f.grading_scale.filter((_,i)=>i!==idx)}));

  /* ── Submit ── */
  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingClass) {
        await updateDoc(doc(db,"classes",editingClass.id), form);
      } else {
        await addDoc(collection(db,"classes"),{...form, uid:user.uid});
      }
      closeModal();
    } catch(err){ console.error(err); }
    setSaving(false);
  };

  /* ── Archive: ask for final grade → check vs calculated GPA → push to degree planner ── */
  const handleArchive = async cls => {
    if (cls.is_active) {
      // Going from active → archived: collect final grade
      const pct = prompt(
        `Archiving "${cls.course_code}"\n\nEnter your final percentage grade (e.g. 87.5) — leave blank to skip:`,
        cls.final_grade_pct || ""
      );
      const finalPct = pct !== null && pct.trim() !== "" ? Number(pct) : null;

      let finalLetter = "";
      let gpaVal = null;
      if (finalPct !== null && !isNaN(finalPct)) {
        const scale = cls.grading_scale || DEFAULT_SCALE;
        const match = scale.find(r => finalPct >= r.min && finalPct <= r.max);
        finalLetter = match?.letter || "";
        gpaVal      = match?.gpaValue ?? null;
      }

      const updates = {
        is_active: false,
        ...(finalPct !== null && !isNaN(finalPct) ? {
          final_grade_pct: finalPct,
          final_letter: finalLetter,
        } : {}),
      };
      await updateDoc(doc(db,"classes",cls.id), updates);

      /* Push to degreeSemesters as a completed course */
      if (cls.semester) {
        await pushArchivedToPlanner(cls, finalPct, finalLetter, gpaVal);
      }

      /* Show GPA verification modal if we have a grade */
      if (finalPct !== null && !isNaN(finalPct) && gpaVal !== null) {
        const profileSnap = await getDoc(doc(db,"users",user.uid));
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        setGpaVerifyModal({
          cls: { ...cls, ...updates, final_grade_pct:finalPct, final_letter:finalLetter },
          calculatedGpaPoints: gpaVal,
          creditHours: Number(cls.credit_hours)||0,
          priorGpa: Number(profile.current_gpa||0),
          priorCredits: Number(profile.completed_credit_hours||0),
          currentStoredGpa: Number(profile.current_gpa||0),
          profile,
        });
      }
    } else {
      // Restoring → just flip back to active
      await updateDoc(doc(db,"classes",cls.id),{ is_active:true });
    }
  };

  /* Push archived class into degreeSemesters */
  const pushArchivedToPlanner = async (cls, finalPct, finalLetter, gpaVal) => {
    const semQuery = query(
      collection(db,"degreeSemesters"),
      where("uid","==",user.uid),
      where("name","==",cls.semester)
    );
    const snap = await new Promise(res => {
      const unsub = onSnapshot(semQuery, s => { unsub(); res(s); });
    });

    const courseEntry = {
      id:          `archived_${cls.id}`,
      course_code: cls.course_code,
      course_name: cls.course_name,
      credit_hours: Number(cls.credit_hours)||0,
      category:    cls.category||"Major",
      core_category: cls.core_category||"",
      status:      "Completed",
      final_grade_pct: finalPct||null,
      final_letter:    finalLetter||"",
      source:      "archived_class",
      class_id:    cls.id,
    };

    if (snap.empty) {
      // Create the semester document
      await addDoc(collection(db,"degreeSemesters"),{
        uid:   user.uid,
        name:  cls.semester,
        order: 999,
        courses: [courseEntry],
      });
    } else {
      const semDoc = snap.docs[0];
      const existing = semDoc.data().courses || [];
      // Replace if already exists (by class_id), otherwise append
      const already = existing.findIndex(c=>c.class_id===cls.id);
      const updated = already>=0
        ? existing.map((c,i)=>i===already ? courseEntry : c)
        : [...existing, courseEntry];
      await updateDoc(doc(db,"degreeSemesters",semDoc.id),{ courses:updated });
    }
  };

  /* ── GPA Verify: user confirms or corrects GPA after archiving ── */
  const handleGpaVerifyConfirm = async (action, manualGpa) => {
    if (!gpaVerifyModal) return;
    const { priorGpa, priorCredits, calculatedGpaPoints, creditHours } = gpaVerifyModal;

    if (action==="accept") {
      // Calculate new cumulative GPA
      const newTotal   = (priorGpa * priorCredits) + (calculatedGpaPoints * creditHours);
      const newCredits = priorCredits + creditHours;
      const newGpa     = newCredits > 0 ? newTotal/newCredits : priorGpa;
      await setDoc(doc(db,"users",user.uid),{
        current_gpa: parseFloat(newGpa.toFixed(3)),
        completed_credit_hours: newCredits,
      },{merge:true});
    } else if (action==="manual" && manualGpa) {
      const newCredits = priorCredits + creditHours;
      await setDoc(doc(db,"users",user.uid),{
        current_gpa: parseFloat(Number(manualGpa).toFixed(3)),
        completed_credit_hours: newCredits,
      },{merge:true});
    }
    // action==="skip" → do nothing
    setGpaVerifyModal(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db,"classes",deleteTarget.id));
    setDeleteTarget(null);
  };

  /* ── Derived ── */
  const active   = classes.filter(c=>c.is_active);
  const archived = classes.filter(c=>!c.is_active);
  const bySemester = active.reduce((acc,cls)=>{
    const key = cls.semester||"Unsorted";
    if(!acc[key]) acc[key]=[];
    acc[key].push(cls);
    return acc;
  },{});
  const totalCredits = active.reduce((s,c)=>s+Number(c.credit_hours||0),0);
  const dayAbbr = d => d.substring(0,2);

  if (!user) return <div className="cls-signin">Please sign in to view classes</div>;

  return (
    <div className="classes-page">
      {/* ── Header ── */}
      <div className="cls-header">
        <div className="cls-header-left">
          <h1>My Classes</h1>
          <p>Manage your courses, schedules, and grading scales</p>
        </div>
        <div className="cls-header-actions">
          <div className="cls-summary-pills">
            <span className="cls-pill blue">{active.length} Active</span>
            <span className="cls-pill teal">{totalCredits} Credits</span>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16}/> Add Class
          </button>
        </div>
      </div>

      {/* ── Active classes ── */}
      {active.length===0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3>No active classes</h3>
          <p>Add your first class to get started</p>
          <button className="btn btn-primary" onClick={openAdd} style={{marginTop:"1rem"}}>
            <Plus size={16}/> Add Class
          </button>
        </div>
      ) : (
        Object.entries(bySemester).map(([semester, semClasses])=>(
          <div key={semester} className="cls-semester-group">
            <div className="cls-semester-label">
              <Calendar size={14}/>
              <span>{semester}</span>
              <span className="cls-semester-count">{semClasses.length} course{semClasses.length!==1?"s":""}</span>
              <span className="cls-semester-cr">
                {semClasses.reduce((s,c)=>s+Number(c.credit_hours||0),0)} credits
              </span>
            </div>
            <div className="cls-grid">
              {semClasses.map(cls=>(
                <ClassCard
                  key={cls.id} cls={cls} dayAbbr={dayAbbr}
                  onEdit={openEdit}
                  onArchive={()=>handleArchive(cls)}
                  onDelete={()=>setDeleteTarget(cls)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Archived ── */}
      {archived.length>0 && (
        <div className="cls-archived-section">
          <button className="cls-archived-toggle" onClick={()=>setShowArchived(v=>!v)}>
            <Archive size={15}/>
            <span>Past Classes ({archived.length})</span>
            {showArchived ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          {showArchived && (
            <div className="cls-grid cls-grid-archived">
              {archived.map(cls=>(
                <div key={cls.id} className="cls-card cls-card-archived">
                  <div className="cls-card-accent" style={{background:"#64748b"}}/>
                  <div className="cls-card-body">
                    <div className="cls-card-top">
                      <div className="cls-card-identity">
                        <span className="cls-category-badge archived-badge">Archived</span>
                        <h3 className="cls-code" style={{color:"#64748b"}}>{cls.course_code}</h3>
                        <p className="cls-name">{cls.course_name}</p>
                        {cls.final_letter && (
                          <span className="cls-final-grade">
                            Final: {cls.final_letter}
                            {cls.final_grade_pct ? ` (${cls.final_grade_pct}%)` : ""}
                          </span>
                        )}
                      </div>
                      <div className="cls-card-actions">
                        <button className="btn btn-ghost cls-action-btn" onClick={()=>handleArchive(cls)}>
                          <RotateCcw size={14}/> Restore
                        </button>
                        <button className="btn-icon" onClick={()=>setDeleteTarget(cls)}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                    <p className="cls-archived-sem">{cls.semester||"—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ADD / EDIT MODAL ══════════ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingClass?"Edit Class":"Add New Class"}</h2>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>

            {/* Sub-tabs */}
            <div className="cls-modal-tabs">
              {["info","schedule","scale"].map(tab=>(
                <button
                  key={tab}
                  className={"cls-modal-tab"+(activeFormTab===tab?" active":"")}
                  onClick={()=>setActiveFormTab(tab)}
                  type="button"
                >
                  {tab==="info"?"📋 Info":tab==="schedule"?"🗓 Schedule":"📊 Grading Scale"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body cls-form">

                {/* ── INFO TAB ── */}
                {activeFormTab==="info" && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Course Code *</label>
                        <input className="form-control" placeholder="e.g. CS 3345"
                          value={form.course_code}
                          onChange={e=>setForm(f=>({...f,course_code:e.target.value}))} required/>
                      </div>
                      <div className="form-group">
                        <label>Credit Hours</label>
                        <input type="number" min="0" max="12" className="form-control"
                          value={form.credit_hours}
                          onChange={e=>setForm(f=>({...f,credit_hours:Number(e.target.value)}))}/>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Course Name *</label>
                      <input className="form-control" placeholder="e.g. Data Structures"
                        value={form.course_name}
                        onChange={e=>setForm(f=>({...f,course_name:e.target.value}))} required/>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Professor</label>
                        <input className="form-control" placeholder="Instructor name"
                          value={form.professor}
                          onChange={e=>setForm(f=>({...f,professor:e.target.value}))}/>
                      </div>
                      <div className="form-group">
                        <label>Room / Location</label>
                        <input className="form-control" placeholder="e.g. ECSS 2.415"
                          value={form.room_number}
                          onChange={e=>setForm(f=>({...f,room_number:e.target.value}))}/>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category</label>
                        <select className="form-control" value={form.category}
                          onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                          {CATEGORY_OPTIONS.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Semester</label>
                        <input className="form-control" list="semester-presets"
                          placeholder="e.g. Fall 2025"
                          value={form.semester}
                          onChange={e=>setForm(f=>({...f,semester:e.target.value}))}/>
                        <datalist id="semester-presets">
                          {SEMESTER_PRESETS.map(s=><option key={s} value={s}/>)}
                        </datalist>
                      </div>
                    </div>
                    {form.category==="Core" && (
                      <div className="form-group">
                        <label>Core Category</label>
                        <input className="form-control" placeholder="e.g. Communication"
                          value={form.core_category}
                          onChange={e=>setForm(f=>({...f,core_category:e.target.value}))}/>
                      </div>
                    )}
                    {/* Color */}
                    <div className="form-group">
                      <label>Class Color</label>
                      <div className="cls-color-row">
                        <div className="cls-color-swatch" style={{background:form.color}}
                          onClick={()=>setShowColorPicker(v=>!v)}/>
                        <span className="cls-color-hex">{form.color}</span>
                      </div>
                      {showColorPicker && (
                        <div className="cls-color-grid">
                          {PRESET_COLORS.map(c=>(
                            <button key={c} type="button"
                              className={"cls-color-btn"+(form.color===c?" ring":"")}
                              style={{background:c}}
                              onClick={()=>{setForm(f=>({...f,color:c}));setShowColorPicker(false);}}/>
                          ))}
                          <input type="color" className="cls-color-custom"
                            value={form.color}
                            onChange={e=>setForm(f=>({...f,color:e.target.value}))}/>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── SCHEDULE TAB ── */}
                {activeFormTab==="schedule" && (
                  <>
                    <div className="form-group">
                      <label>Days of Week</label>
                      <div className="cls-days-picker">
                        {DAYS.map(day=>(
                          <button key={day} type="button"
                            className={"cls-day-btn"+(form.days.includes(day)?" active":"")}
                            onClick={()=>toggleDay(day)}>
                            {day.substring(0,3)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Time</label>
                        <input type="time" className="form-control" value={form.start_time}
                          onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/>
                      </div>
                      <div className="form-group">
                        <label>End Time</label>
                        <input type="time" className="form-control" value={form.end_time}
                          onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/>
                      </div>
                    </div>
                  </>
                )}

                {/* ── GRADING SCALE TAB ── */}
                {activeFormTab==="scale" && (
                  <div className="cls-scale-section">
                    <div className="cls-scale-note">
                      <AlertCircle size={13}/>
                      Define this class's grading scale. Used in Grade Tracker and GPA Calculator
                      to calculate the correct letter grade for this specific course.
                    </div>

                    <div className="cls-scale-table">
                      <div className="cls-scale-head">
                        <span>Letter</span>
                        <span>Min %</span>
                        <span>Max %</span>
                        <span>GPA Pts</span>
                        <span></span>
                      </div>
                      {form.grading_scale.map((row,idx)=>(
                        <div key={idx} className="cls-scale-row">
                          <input
                            className="cls-scale-input letter"
                            placeholder="A+"
                            value={row.letter}
                            onChange={e=>updateScaleRow(idx,"letter",e.target.value)}/>
                          <input
                            className="cls-scale-input"
                            type="number" min="0" max="100" step="0.1"
                            value={row.min}
                            onChange={e=>updateScaleRow(idx,"min",e.target.value)}/>
                          <input
                            className="cls-scale-input"
                            type="number" min="0" max="100" step="0.1"
                            value={row.max}
                            onChange={e=>updateScaleRow(idx,"max",e.target.value)}/>
                          <input
                            className="cls-scale-input"
                            type="number" min="0" max="5" step="0.01"
                            value={row.gpaValue??0}
                            onChange={e=>updateScaleRow(idx,"gpaValue",e.target.value)}/>
                          <button type="button" className="cls-scale-remove"
                            onClick={()=>removeScaleRow(idx)}>×</button>
                        </div>
                      ))}
                    </div>

                    <button type="button" className="cls-scale-add-row" onClick={addScaleRow}>
                      <Plus size={13}/> Add Grade Row
                    </button>

                    <button type="button" className="cls-scale-reset"
                      onClick={()=>setForm(f=>({...f,grading_scale:DEFAULT_SCALE.map(r=>({...r}))}))}>
                      Reset to Default 4.0 Scale
                    </button>

                    {/* Preview */}
                    <div className="cls-scale-preview">
                      {form.grading_scale.filter(r=>r.letter).map((r,i)=>(
                        <span key={i} className="cls-scale-preview-chip"
                          style={{
                            color: r.gpaValue>=3.5?"#10b981":r.gpaValue>=3?"#3b82f6":r.gpaValue>=2?"#f59e0b":"#ef4444",
                            borderColor: r.gpaValue>=3.5?"rgba(16,185,129,0.3)":r.gpaValue>=3?"rgba(59,130,246,0.3)":r.gpaValue>=2?"rgba(245,158,11,0.3)":"rgba(239,68,68,0.3)",
                          }}>
                          {r.letter} {r.min}–{r.max}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tab navigation buttons */}
              <div className="modal-footer cls-modal-footer">
                <div className="cls-modal-tab-nav">
                  {activeFormTab!=="info" && (
                    <button type="button" className="btn btn-secondary"
                      onClick={()=>setActiveFormTab(activeFormTab==="scale"?"schedule":"info")}>
                      ← Back
                    </button>
                  )}
                  {activeFormTab!=="scale" && (
                    <button type="button" className="btn btn-secondary"
                      onClick={()=>setActiveFormTab(activeFormTab==="info"?"schedule":"scale")}>
                      Next →
                    </button>
                  )}
                </div>
                <div style={{flex:1}}/>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?"Saving…":editingClass?"Update Class":"Add Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ GPA VERIFICATION MODAL ══════════ */}
      {gpaVerifyModal && <GpaVerifyModal data={gpaVerifyModal} onAction={handleGpaVerifyConfirm}/>}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-body" style={{textAlign:"center",padding:"2rem 1.5rem"}}>
              <div className="delete-modal-icon">🗑️</div>
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>Delete Class?</h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>
                <strong style={{color:"var(--text-secondary)"}}>
                  {deleteTarget.course_code} – {deleteTarget.course_name}
                </strong><br/>This cannot be undone.
              </p>
            </div>
            <div className="modal-footer" style={{justifyContent:"center"}}>
              <button className="btn btn-secondary" onClick={()=>setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── GPA Verification Modal ── */
function GpaVerifyModal({ data, onAction }) {
  const { cls, calculatedGpaPoints, creditHours, priorGpa, priorCredits, currentStoredGpa } = data;
  const [manualGpa, setManualGpa] = useState("");
  const [mode, setMode] = useState("auto"); // auto | manual

  const newCalcGpa = priorCredits + creditHours > 0
    ? ((priorGpa * priorCredits) + (calculatedGpaPoints * creditHours)) / (priorCredits + creditHours)
    : calculatedGpaPoints;

  const gpaColor = g => {
    if (g>=3.7) return "#10b981"; if (g>=3.0) return "#3b82f6";
    if (g>=2.5) return "#f59e0b"; return "#ef4444";
  };

  return (
    <div className="modal-overlay">
      <div className="modal cls-gpa-verify" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Update Cumulative GPA?</h2>
            <p style={{fontSize:"0.8rem",color:"var(--text-muted)",marginTop:"2px"}}>
              {cls.course_code} has been archived with a final grade
            </p>
          </div>
        </div>

        <div className="modal-body">
          {/* Grade summary */}
          <div className="gpa-verify-summary">
            <div className="gpa-verify-item">
              <span className="gpa-verify-label">Final Grade</span>
              <span className="gpa-verify-val" style={{color:gpaColor(calculatedGpaPoints)}}>
                {cls.final_letter} ({cls.final_grade_pct}%)
              </span>
            </div>
            <div className="gpa-verify-item">
              <span className="gpa-verify-label">GPA Points</span>
              <span className="gpa-verify-val">{calculatedGpaPoints?.toFixed(2)}</span>
            </div>
            <div className="gpa-verify-item">
              <span className="gpa-verify-label">Credit Hours</span>
              <span className="gpa-verify-val">{creditHours}</span>
            </div>
          </div>

          {/* GPA comparison */}
          <div className="gpa-verify-compare">
            <div className="gpa-verify-col">
              <span className="gpa-verify-col-label">Current GPA</span>
              <span className="gpa-verify-col-val" style={{color:gpaColor(currentStoredGpa)}}>
                {currentStoredGpa?.toFixed(2)||"—"}
              </span>
            </div>
            <div className="gpa-verify-arrow">→</div>
            <div className="gpa-verify-col highlight">
              <span className="gpa-verify-col-label">Calculated New GPA</span>
              <span className="gpa-verify-col-val" style={{color:gpaColor(newCalcGpa)}}>
                {newCalcGpa.toFixed(3)}
              </span>
            </div>
          </div>

          <p className="gpa-verify-note">
            This is calculated from your prior GPA ({priorGpa?.toFixed(2)||"—"}) ×{" "}
            {priorCredits} credits + this class's {calculatedGpaPoints?.toFixed(2)} GPA pts × {creditHours} credits.
            Does this match your transcript?
          </p>

          {/* Manual override */}
          <div className="gpa-verify-mode-toggle">
            <button
              className={"gpa-mode-btn"+(mode==="auto"?" active":"")}
              type="button"
              onClick={()=>setMode("auto")}
            >
              <CheckCircle size={13}/> Use calculated ({newCalcGpa.toFixed(3)})
            </button>
            <button
              className={"gpa-mode-btn"+(mode==="manual"?" active":"")}
              type="button"
              onClick={()=>setMode("manual")}
            >
              ✏️ Enter manually
            </button>
          </div>

          {mode==="manual" && (
            <div className="form-group" style={{marginTop:"0.75rem",animation:"fadeSlideUp 0.2s ease"}}>
              <label>Your Actual Cumulative GPA</label>
              <input
                type="number" step="0.001" min="0" max="5"
                className="form-control"
                placeholder="e.g. 3.721"
                value={manualGpa}
                onChange={e=>setManualGpa(e.target.value)}
                autoFocus
              />
              <span style={{fontSize:"0.72rem",color:"var(--text-muted)",marginTop:"4px",display:"block"}}>
                Enter the exact GPA shown on your transcript
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={()=>onAction("skip")}>
            Skip — update manually later
          </button>
          <div style={{flex:1}}/>
          {mode==="auto" ? (
            <button className="btn btn-primary" onClick={()=>onAction("accept")}>
              <CheckCircle size={14}/> Update to {newCalcGpa.toFixed(3)}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!manualGpa}
              onClick={()=>onAction("manual",manualGpa)}
            >
              Save {manualGpa ? Number(manualGpa).toFixed(3) : "GPA"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Class Card ── */
function ClassCard({ cls, dayAbbr, onEdit, onArchive, onDelete }) {
  return (
    <div className="cls-card">
      <div className="cls-card-accent" style={{background:cls.color}}/>
      <div className="cls-card-body">
        <div className="cls-card-top">
          <div className="cls-card-identity">
            <span className="cls-category-badge" style={{
              background:cls.color+"22", color:cls.color, border:`1px solid ${cls.color}44`
            }}>{cls.category}</span>
            <h3 className="cls-code" style={{color:cls.color}}>{cls.course_code}</h3>
            <p className="cls-name">{cls.course_name}</p>
            {/* Show grading scale indicator */}
            {cls.grading_scale && (
              <span className="cls-scale-badge" title="Custom grading scale">
                📊 Custom scale
              </span>
            )}
          </div>
          <div className="cls-card-actions">
            <button className="btn-icon" onClick={()=>onEdit(cls)} title="Edit"><Edit2 size={14}/></button>
            <button className="btn-icon" onClick={onArchive} title="Archive"><Archive size={14}/></button>
            <button className="btn-icon cls-delete-btn" onClick={onDelete} title="Delete"><Trash2 size={14}/></button>
          </div>
        </div>
        <div className="cls-card-divider"/>
        <div className="cls-meta-grid">
          <div className="cls-meta-item"><User size={12}/><span>{cls.professor||"TBD"}</span></div>
          <div className="cls-meta-item"><BookOpen size={12}/><span>{cls.credit_hours} cr · {cls.category}</span></div>
          {(cls.start_time||cls.end_time) && (
            <div className="cls-meta-item"><Clock size={12}/><span>{cls.start_time}{cls.end_time?` – ${cls.end_time}`:""}</span></div>
          )}
          {cls.room_number && (
            <div className="cls-meta-item"><Calendar size={12}/><span>{cls.room_number}</span></div>
          )}
        </div>
        <div className="cls-days-row">
          {DAYS.map(day=>(
            <div key={day}
              className={"cls-day-pip"+(cls.days?.includes(day)?" active":"")}
              style={cls.days?.includes(day)?{background:cls.color}:{}}>
              {dayAbbr(day)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
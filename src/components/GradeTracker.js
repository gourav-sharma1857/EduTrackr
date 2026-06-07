import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
  getDoc, setDoc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp,
  Trophy, TrendingUp, AlertCircle, CheckCircle,
  Folder, FolderOpen, Sliders, Target
} from "lucide-react";
import "../styles/GradeTracker.css";

const CATEGORIES = ["Homework","Quiz","Test","Project","Lab","Essay","Exam","Midterm","Final","Other"];

/* ── Grade helpers ── */
const scaleMin = row => row.min ?? row.minPercent ?? 0;
const scaleMax = row => row.max ?? row.maxPercent ?? 100;
const getLetterFromScale = (pct, scale) => {
  if (!scale || !scale.length) return defaultLetter(pct);
  for (const row of scale) {
    if (pct >= scaleMin(row) && pct <= scaleMax(row))
      return { letter: row.letter, gpa: row.gpaValue ?? 0 };
  }
  const sorted = [...scale].sort((a,b) => scaleMin(a) - scaleMin(b));
  return { letter: sorted[0].letter, gpa: sorted[0].gpaValue ?? 0 };
};

const defaultLetter = (pct) => {
  if (pct >= 97) return { letter:"A+", gpa:4.0 };
  if (pct >= 93) return { letter:"A",  gpa:4.0 };
  if (pct >= 90) return { letter:"A-", gpa:3.67 };
  if (pct >= 87) return { letter:"B+", gpa:3.33 };
  if (pct >= 83) return { letter:"B",  gpa:3.0  };
  if (pct >= 80) return { letter:"B-", gpa:2.67 };
  if (pct >= 77) return { letter:"C+", gpa:2.33 };
  if (pct >= 73) return { letter:"C",  gpa:2.0  };
  if (pct >= 70) return { letter:"C-", gpa:1.67 };
  if (pct >= 67) return { letter:"D+", gpa:1.33 };
  if (pct >= 63) return { letter:"D",  gpa:1.0  };
  if (pct >= 60) return { letter:"D-", gpa:0.67 };
  return { letter:"F", gpa:0.0 };
};

const gradeColor = (pct) => {
  if (pct >= 90) return "#10b981";
  if (pct >= 80) return "#3b82f6";
  if (pct >= 70) return "#f59e0b";
  if (pct >= 60) return "#f97316";
  return "#ef4444";
};

export default function GradeTracker() {
  const [user, setUser]                   = useState(null);
  const [classes, setClasses]             = useState([]);
  const [completedA, setCompletedA]       = useState([]);
  const [pendingA, setPendingA]           = useState([]);
  const [categoryWeights, setCategoryWeights] = useState({});
  const [gpaScale, setGpaScale]           = useState(null);
  const [anticipatedGrades, setAnticipatedGrades] = useState({});
  const [expandedFolders, setExpandedFolders]     = useState({});
  const [expandedAnticipate, setExpandedAnticipate] = useState({});
  const [showWeightsFor, setShowWeightsFor] = useState(null);

  /* Modals */
  const [gradeModal,  setGradeModal]   = useState(null); // assignment obj
  const [manualModal, setManualModal]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [earnedPts, setEarnedPts]      = useState("");
  const [manualForm, setManualForm]    = useState({
    title:"", category:"Homework", total_points:"", earned_points:"", class_id:""
  });

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  /* ── Firestore ── */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const subs = [];

    subs.push(onSnapshot(
      query(collection(db,"classes"), where("uid","==",uid), where("is_active","==",true)),
      s => setClasses(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"assignments"), where("uid","==",uid), where("is_completed","==",true)),
      s => setCompletedA(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"assignments"), where("uid","==",uid), where("is_completed","==",false)),
      s => setPendingA(s.docs.map(d=>({id:d.id,...d.data()})))
    ));

    const loadExtras = async () => {
      const wSnap = await getDoc(doc(db,"categoryWeights",uid));
      if (wSnap.exists()) setCategoryWeights(wSnap.data().weights || {});

      const gSnap = await getDoc(doc(db,"gpaScale",uid));
      if (gSnap.exists()) setGpaScale(gSnap.data().scale || null);
    };
    loadExtras();

    return () => subs.forEach(u => u());
  }, [user]);

  /* ── Computed grade for a class ── */
  const calcGrade = (classId, includeAnticipated = false) => {
    const graded  = completedA.filter(a => a.class_id === classId && a.is_graded);
    const pending = pendingA.filter(a => a.class_id === classId);
    if (!graded.length && !includeAnticipated) return null;
    if (!graded.length && !pending.filter(a => anticipatedGrades[a.id] > 0).length) return null;

    const cats = {};
    graded.forEach(a => {
      const c = a.category || "Other";
      if (!cats[c]) cats[c] = { total:0, earned:0, weight: categoryWeights[`${classId}_${c}`] || 0 };
      cats[c].total  += a.total_points  || 0;
      cats[c].earned += a.earned_points || 0;
    });

    if (includeAnticipated) {
      pending.forEach(a => {
        const ant = anticipatedGrades[a.id];
        if (!ant) return;
        const c = a.category || "Other";
        if (!cats[c]) cats[c] = { total:0, earned:0, weight: categoryWeights[`${classId}_${c}`] || 0 };
        cats[c].total  += a.total_points || 0;
        cats[c].earned += ((ant / 100) * (a.total_points || 0));
      });
    }

    Object.values(cats).forEach(c => {
      c.pct = c.total > 0 ? (c.earned / c.total) * 100 : 0;
    });

    const totalWeight = Object.values(cats).reduce((s,c) => s + c.weight, 0);
    let finalPct;
    if (totalWeight > 0 && totalWeight <= 100) {
      const ws = Object.values(cats).reduce((s,c) => s + (c.pct * (c.weight / 100)), 0);
      finalPct = (ws / totalWeight) * 100;
    } else {
      const tp = graded.reduce((s,a) => s+(a.total_points||0), 0);
      const ep = graded.reduce((s,a) => s+(a.earned_points||0), 0);
      if (includeAnticipated) {
        let atp=0, aep=0;
        pending.forEach(a => {
          const ant = anticipatedGrades[a.id];
          if (!ant) return;
          atp += a.total_points || 0;
          aep += (ant/100)*(a.total_points||0);
        });
        finalPct = (tp+atp) > 0 ? ((ep+aep)/(tp+atp))*100 : 0;
      } else {
        finalPct = tp > 0 ? (ep/tp)*100 : 0;
      }
    }

    const getScaleForClass = (classId) => {
      const cls = classes.find(c => c.id === classId);
      return cls?.grading_scale || gpaScale;
    };
    const grade = getLetterFromScale(finalPct, getScaleForClass(classId));
    return { pct: finalPct, grade, cats, count: graded.length };
  };

  /* ── Grade actions ── */
  const saveGrade = async e => {
    e.preventDefault();
    await updateDoc(doc(db,"assignments",gradeModal.id),{
      earned_points: Number(earnedPts), is_graded: true
    });
    setGradeModal(null); setEarnedPts("");
  };

  const saveManual = async e => {
    e.preventDefault();
    await addDoc(collection(db,"assignments"),{
      ...manualForm,
      total_points:  Number(manualForm.total_points),
      earned_points: Number(manualForm.earned_points),
      is_completed: true, is_graded: true,
      uid: user.uid, created_at: new Date()
    });
    setManualModal(false);
    setManualForm({title:"",category:"Homework",total_points:"",earned_points:"",class_id:""});
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db,"assignments",deleteTarget.id));
    setDeleteTarget(null);
  };

  const saveWeight = async (classId, cat, val) => {
    const key = `${classId}_${cat}`;
    const updated = { ...categoryWeights, [key]: Number(val) };
    setCategoryWeights(updated);
    await setDoc(doc(db,"categoryWeights",user.uid),{ weights: updated },{ merge:true });
  };

  /* ── Toggle helpers ── */
  const toggleFolder = key =>
    setExpandedFolders(p => ({ ...p, [key]: !p[key] }));
  const toggleAnt = key =>
    setExpandedAnticipate(p => ({ ...p, [key]: !p[key] }));

  /* ── Classes with any data ── */
  const activeClasses = useMemo(() =>
    classes.filter(cls =>
      completedA.some(a=>a.class_id===cls.id) ||
      pendingA.some(a=>a.class_id===cls.id)
    )
  , [classes, completedA, pendingA]);

  /* ── Summary stats ── */
  const totalGraded = completedA.filter(a=>a.is_graded).length;
  const avgGrade = useMemo(() => {
    const grades = activeClasses.map(cls => calcGrade(cls.id)).filter(Boolean);
    if (!grades.length) return null;
    return grades.reduce((s,g) => s+g.pct, 0) / grades.length;
  }, [activeClasses, completedA, categoryWeights]);

  if (!user) return <div className="gt-signin">Please sign in to view Grade Tracker</div>;

  return (
    <div className="grade-tracker">
      {/* ── Header ── */}
      <div className="gt-header">
        <div>
          <h1>Grade Tracker</h1>
          <p>Monitor performance and project future grades</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setManualModal(true)}>
          <Plus size={16}/> Quick Add Grade
        </button>
      </div>

      {/* ── Summary row ── */}
      <div className="gt-summary stagger-1">
        <div className="gt-stat">
          <div className="gt-stat-icon" style={{background:"rgba(234,179,8,0.12)",color:"#facc15"}}>
            <Trophy size={20}/>
          </div>
          <div>
            <span className="gt-stat-val">{totalGraded}</span>
            <span className="gt-stat-label">Graded</span>
          </div>
        </div>
        <div className="gt-stat">
          <div className="gt-stat-icon" style={{background:"rgba(59,130,246,0.12)",color:"#60a5fa"}}>
            <TrendingUp size={20}/>
          </div>
          <div>
            <span className="gt-stat-val" style={{color: avgGrade ? gradeColor(avgGrade) : "var(--text-muted)"}}>
              {avgGrade ? avgGrade.toFixed(1)+"%" : "—"}
            </span>
            <span className="gt-stat-label">Avg Grade</span>
          </div>
        </div>
        <div className="gt-stat">
          <div className="gt-stat-icon" style={{background:"rgba(168,85,247,0.12)",color:"#c084fc"}}>
            <Target size={20}/>
          </div>
          <div>
            <span className="gt-stat-val">{pendingA.length}</span>
            <span className="gt-stat-label">Ungraded</span>
          </div>
        </div>
        <div className="gt-stat">
          <div className="gt-stat-icon" style={{background:"rgba(16,185,129,0.12)",color:"#34d399"}}>
            <CheckCircle size={20}/>
          </div>
          <div>
            <span className="gt-stat-val">{activeClasses.length}</span>
            <span className="gt-stat-label">Classes</span>
          </div>
        </div>
      </div>

      {/* ── No data ── */}
      {activeClasses.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No grade data yet</h3>
          <p>Complete and grade some assignments to start tracking</p>
          <button className="btn btn-primary" style={{marginTop:"1rem"}} onClick={()=>setManualModal(true)}>
            <Plus size={15}/> Add a Grade
          </button>
        </div>
      )}

      {/* ── Class cards ── */}
      <div className="gt-cards">
        {activeClasses.map(cls => {
          const currentGrade    = calcGrade(cls.id, false);
          const projectedGrade  = calcGrade(cls.id, true);
          const graded          = completedA.filter(a=>a.class_id===cls.id && a.is_graded);
          const ungraded        = completedA.filter(a=>a.class_id===cls.id && !a.is_graded);
          const pending         = pendingA.filter(a=>a.class_id===cls.id);
          const showWeights     = showWeightsFor === cls.id;

          /* Group graded by category */
          const gradedByCat = graded.reduce((acc,a) => {
            const c = a.category||"Other";
            if (!acc[c]) acc[c] = [];
            acc[c].push(a); return acc;
          }, {});

          /* Group pending by category */
          const pendingByCat = pending.reduce((acc,a) => {
            const c = a.category||"Other";
            if (!acc[c]) acc[c] = [];
            acc[c].push(a); return acc;
          }, {});

          const allCats = [...new Set([
            ...Object.keys(gradedByCat),
            ...Object.keys(pendingByCat)
          ])].sort();

          return (
            <div key={cls.id} className="gt-card" style={{borderTopColor:cls.color||"#3b82f6"}}>
              {/* Card header */}
              <div className="gt-card-header">
                <div className="gt-card-identity">
                  <div className="gt-card-color-dot" style={{background:cls.color||"#3b82f6"}}/>
                  <div>
                    <h2 className="gt-card-code">{cls.course_code}</h2>
                    <p className="gt-card-name">{cls.course_name}</p>
                  </div>
                </div>
                <div className="gt-card-grades">
                  {currentGrade && (
                    <div className="gt-grade-pill" style={{
                      background: gradeColor(currentGrade.pct)+"18",
                      borderColor: gradeColor(currentGrade.pct)+"44"
                    }}>
                      <span className="gt-grade-letter" style={{color:gradeColor(currentGrade.pct)}}>
                        {currentGrade.grade.letter}
                      </span>
                      <span className="gt-grade-pct">{currentGrade.pct.toFixed(1)}%</span>
                      <span className="gt-grade-sub">Current</span>
                    </div>
                  )}
                  {projectedGrade && projectedGrade.pct !== currentGrade?.pct && (
                    <div className="gt-grade-pill projected">
                      <span className="gt-grade-letter" style={{color:gradeColor(projectedGrade.pct)}}>
                        {projectedGrade.grade.letter}
                      </span>
                      <span className="gt-grade-pct">{projectedGrade.pct.toFixed(1)}%</span>
                      <span className="gt-grade-sub">Projected</span>
                    </div>
                  )}
                  {!currentGrade && (
                    <span className="gt-no-grade">No grades yet</span>
                  )}
                </div>
              </div>

              {/* Stats strip */}
              <div className="gt-card-stats">
                <span>{graded.length} graded</span>
                {ungraded.length>0 && (
                  <span className="gt-ungraded-warn">
                    <AlertCircle size={11}/> {ungraded.length} ungraded
                  </span>
                )}
                <span>{pending.length} pending</span>
                <button
                  className={"gt-weight-toggle"+(showWeights?" active":"")}
                  onClick={()=>setShowWeightsFor(showWeights?null:cls.id)}
                >
                  <Sliders size={12}/> Weights
                </button>
              </div>

              {/* Grade bar visual */}
              {currentGrade && (
                <div className="gt-grade-bar-wrap">
                  <div className="gt-grade-bar-track">
                    <div className="gt-grade-bar-fill"
                      style={{width:currentGrade.pct+"%", background:gradeColor(currentGrade.pct)}}/>
                    {projectedGrade && projectedGrade.pct > currentGrade.pct && (
                      <div className="gt-grade-bar-proj"
                        style={{
                          width:(projectedGrade.pct - currentGrade.pct)+"%",
                          left:currentGrade.pct+"%",
                          background:gradeColor(projectedGrade.pct)+"44"
                        }}/>
                    )}
                  </div>
                  <div className="gt-grade-bar-markers">
                    {[60,70,80,90].map(m=>(
                      <div key={m} className="gt-marker" style={{left:m+"%"}}>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Category weights panel ── */}
              {showWeights && (
                <div className="gt-weights-panel">
                  <p className="gt-weights-hint">
                    Set weights per category (should total 100%). Leave at 0 for point-based calculation.
                  </p>
                  <div className="gt-weights-grid">
                    {allCats.map(cat => {
                      const w = categoryWeights[`${cls.id}_${cat}`] || 0;
                      return (
                        <div key={cat} className="gt-weight-row">
                          <span className="gt-weight-cat">{cat}</span>
                          <div className="gt-weight-input-wrap">
                            <input
                              type="number" min="0" max="100"
                              className="gt-weight-input"
                              value={w}
                              onChange={e=>saveWeight(cls.id, cat, e.target.value)}
                            />
                            <span>%</span>
                          </div>
                          {currentGrade?.cats?.[cat] && (
                            <span className="gt-weight-preview" style={{color:gradeColor(currentGrade.cats[cat].pct)}}>
                              {currentGrade.cats[cat].pct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="gt-weight-total">
                    Total: <strong style={{
                      color: allCats.reduce((s,c)=>s+(categoryWeights[`${cls.id}_${c}`]||0),0)===100
                        ? "#10b981" : "#f59e0b"
                    }}>
                      {allCats.reduce((s,c)=>s+(categoryWeights[`${cls.id}_${c}`]||0),0)}%
                    </strong>
                  </div>
                </div>
              )}

              {/* ── Graded assignments by category ── */}
              {Object.keys(gradedByCat).length > 0 && (
                <div className="gt-section">
                  <div className="gt-section-label">Graded Assignments</div>
                  {Object.entries(gradedByCat).sort(([a],[b])=>a.localeCompare(b)).map(([cat,items])=>{
                    const fKey  = `${cls.id}_graded_${cat}`;
                    const isOpen = expandedFolders[fKey] !== false;
                    const catPct = currentGrade?.cats?.[cat]?.pct;
                    return (
                      <div key={fKey} className="gt-folder">
                        <button
                          className="gt-folder-header"
                          onClick={()=>toggleFolder(fKey)}
                        >
                          <span className="gt-folder-icon">
                            {isOpen
                              ? <FolderOpen size={14} style={{color:cls.color||"#3b82f6"}}/>
                              : <Folder     size={14} style={{color:cls.color||"#3b82f6"}}/>
                            }
                          </span>
                          <span className="gt-folder-name">{cat}</span>
                          <span className="gt-folder-count">{items.length}</span>
                          {catPct !== undefined && (
                            <span className="gt-folder-avg" style={{color:gradeColor(catPct)}}>
                              {catPct.toFixed(1)}%
                            </span>
                          )}
                          {isOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                        </button>

                        {isOpen && (
                          <div className="gt-folder-rows">
                            {items.sort((a,b)=>new Date(a.due_date||0)-new Date(b.due_date||0)).map(a=>{
                              const pct = a.is_graded && a.total_points
                                ? (a.earned_points/a.total_points)*100 : null;
                              return (
                                <div key={a.id} className="gt-row">
                                  <div className="gt-row-info">
                                    <span className="gt-row-title">{a.title}</span>
                                    <span className="gt-row-pts">
                                      {a.total_points} pts
                                      {a.due_date && ` · ${new Date(a.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}`}
                                    </span>
                                  </div>
                                  <div className="gt-row-right">
                                    {a.is_graded && pct !== null ? (
                                      <div className="gt-score-wrap">
                                        <div className="gt-score-bar-track">
                                          <div className="gt-score-bar-fill"
                                            style={{width:pct+"%", background:gradeColor(pct)}}/>
                                        </div>
                                        <span className="gt-score-text" style={{color:gradeColor(pct)}}>
                                          {a.earned_points}/{a.total_points}
                                          <span className="gt-score-pct">({pct.toFixed(1)}%)</span>
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="gt-ungraded-badge">
                                        <AlertCircle size={11}/> Ungraded
                                      </span>
                                    )}
                                    <div className="gt-row-actions">
                                      <button className="btn-icon gt-action"
                                        onClick={()=>{setGradeModal(a);setEarnedPts(a.earned_points||"");}}>
                                        <Edit2 size={12}/>
                                      </button>
                                      <button className="btn-icon gt-action gt-del"
                                        onClick={()=>setDeleteTarget(a)}>
                                        <Trash2 size={12}/>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Ungraded completed assignments ── */}
              {ungraded.length > 0 && (
                <div className="gt-section gt-ungraded-section">
                  <div className="gt-section-label warn">
                    <AlertCircle size={13}/> Needs Grading ({ungraded.length})
                  </div>
                  <div className="gt-folder-rows">
                    {ungraded.map(a=>(
                      <div key={a.id} className="gt-row gt-row-ungraded">
                        <div className="gt-row-info">
                          <span className="gt-row-title">{a.title}</span>
                          <span className="gt-row-pts">{a.total_points} pts · {a.category}</span>
                        </div>
                        <div className="gt-row-right">
                          <button className="btn btn-primary gt-enter-grade-btn"
                            onClick={()=>{setGradeModal(a);setEarnedPts("");}}>
                            Enter Grade
                          </button>
                          <button className="btn-icon gt-action gt-del"
                            onClick={()=>setDeleteTarget(a)}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Grade Anticipator ── */}
              {pending.length > 0 && (
                <div className="gt-section">
                  <button
                    className="gt-section-label gt-anticipate-toggle"
                    onClick={()=>toggleAnt(cls.id)}
                  >
                    <Sliders size={13}/>
                    Grade Anticipator ({pending.length} pending)
                    {expandedAnticipate[cls.id] ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                  </button>

                  {expandedAnticipate[cls.id] && (
                    <div className="gt-anticipate-body">
                      <p className="gt-anticipate-hint">
                        Drag sliders to see how future grades could affect your overall score
                      </p>
                      {Object.entries(pendingByCat).sort(([a],[b])=>a.localeCompare(b)).map(([cat,items])=>(
                        <div key={cat} className="gt-ant-cat">
                          <div className="gt-ant-cat-label">{cat}</div>
                          {items.map(a=>{
                            const val = anticipatedGrades[a.id] || 0;
                            return (
                              <div key={a.id} className="gt-ant-row">
                                <div className="gt-ant-info">
                                  <span className="gt-row-title">{a.title}</span>
                                  <span className="gt-row-pts">{a.total_points} pts</span>
                                </div>
                                <div className="gt-ant-slider-wrap">
                                  <input
                                    type="range" min="0" max="100"
                                    className="gt-slider"
                                    value={val}
                                    style={{"--fill": gradeColor(val)}}
                                    onChange={e=>setAnticipatedGrades(p=>({...p,[a.id]:Number(e.target.value)}))}
                                  />
                                  <span className="gt-ant-val" style={{color:gradeColor(val)}}>
                                    {val}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Grade entry modal ── */}
      {gradeModal && (
        <div className="modal-overlay" onClick={()=>setGradeModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{gradeModal.is_graded?"Edit Grade":"Enter Grade"}</h2>
              <button className="btn-icon" onClick={()=>setGradeModal(null)}>✕</button>
            </div>
            <form onSubmit={saveGrade}>
              <div className="modal-body gt-grade-form">
                <div className="gt-grade-info-block">
                  <div className="gt-grade-info-row">
                    <span>Assignment</span>
                    <strong>{gradeModal.title}</strong>
                  </div>
                  <div className="gt-grade-info-row">
                    <span>Category</span>
                    <strong>{gradeModal.category}</strong>
                  </div>
                  <div className="gt-grade-info-row">
                    <span>Total Points</span>
                    <strong>{gradeModal.total_points}</strong>
                  </div>
                </div>
                <div className="form-group">
                  <label>Points Earned *</label>
                  <input
                    type="number" step="0.01"
                    min="0" max={gradeModal.total_points}
                    className="form-control"
                    value={earnedPts}
                    onChange={e=>setEarnedPts(e.target.value)}
                    placeholder="Enter points earned"
                    autoFocus required
                  />
                </div>
                {earnedPts !== "" && (
                  <div className="gt-grade-preview">
                    <div className="gt-preview-pct" style={{
                      color: gradeColor((Number(earnedPts)/gradeModal.total_points)*100)
                    }}>
                      {((Number(earnedPts)/gradeModal.total_points)*100).toFixed(2)}%
                    </div>
                    <div className="gt-preview-letter" style={{
                      color: gradeColor((Number(earnedPts)/gradeModal.total_points)*100)
                    }}>
                      {getLetterFromScale((Number(earnedPts)/gradeModal.total_points)*100, gpaScale).letter}
                    </div>
                    <div className="gt-preview-bar">
                      <div style={{
                        width: ((Number(earnedPts)/gradeModal.total_points)*100)+"%",
                        background: gradeColor((Number(earnedPts)/gradeModal.total_points)*100),
                        height:"100%", borderRadius:"3px", transition:"width 0.3s"
                      }}/>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setGradeModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Grade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manual grade modal ── */}
      {manualModal && (
        <div className="modal-overlay" onClick={()=>setManualModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quick Add Grade</h2>
              <button className="btn-icon" onClick={()=>setManualModal(false)}>✕</button>
            </div>
            <form onSubmit={saveManual}>
              <div className="modal-body gt-grade-form">
                <div className="form-group">
                  <label>Class *</label>
                  <select className="form-control" value={manualForm.class_id}
                    onChange={e=>setManualForm(f=>({...f,class_id:e.target.value}))} required>
                    <option value="">— Select class —</option>
                    {classes.map(c=>(
                      <option key={c.id} value={c.id}>{c.course_code} · {c.course_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title *</label>
                  <input className="form-control" placeholder="e.g. Midterm Exam"
                    value={manualForm.title}
                    onChange={e=>setManualForm(f=>({...f,title:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select className="form-control" value={manualForm.category}
                    onChange={e=>setManualForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Points Earned *</label>
                    <input type="number" min="0" className="form-control"
                      value={manualForm.earned_points}
                      onChange={e=>setManualForm(f=>({...f,earned_points:e.target.value}))} required/>
                  </div>
                  <div className="form-group">
                    <label>Total Points *</label>
                    <input type="number" min="1" className="form-control"
                      value={manualForm.total_points}
                      onChange={e=>setManualForm(f=>({...f,total_points:e.target.value}))} required/>
                  </div>
                </div>
                {manualForm.earned_points && manualForm.total_points && (
                  <div className="gt-grade-preview">
                    <div className="gt-preview-pct" style={{
                      color: gradeColor((Number(manualForm.earned_points)/Number(manualForm.total_points))*100)
                    }}>
                      {((Number(manualForm.earned_points)/Number(manualForm.total_points))*100).toFixed(2)}%
                      {" · "}
                      {getLetterFromScale((Number(manualForm.earned_points)/Number(manualForm.total_points))*100, gpaScale).letter}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setManualModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Grade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-body" style={{textAlign:"center",padding:"2rem 1.5rem"}}>
              <div className="delete-modal-icon">🗑️</div>
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>Delete Grade?</h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>
                <strong style={{color:"var(--text-secondary)"}}>{deleteTarget.title}</strong><br/>
                This cannot be undone.
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
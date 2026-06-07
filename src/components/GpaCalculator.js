import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { Calculator, TrendingUp, BookOpen, ChevronDown, ChevronUp, Info, Target, Sliders } from "lucide-react";
import { resolveScale, getLetter, gradeColor, pctColor, calcClassGrade } from "../utils/gradeUtils.js";
import "../styles/GpaCalculator.css";

export default function GpaCalculator() {
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [classes, setClasses]   = useState([]);
  const [gradedA, setGradedA]   = useState([]);
  const [categoryWeights, setCategoryWeights] = useState({});
  const [globalScale, setGlobalScale] = useState(null);
  const [maxGpa, setMaxGpa]     = useState(4.0);
  const [expandedClass, setExpandedClass] = useState(null);
  const [showScale, setShowScale]   = useState(false);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfGrades, setWhatIfGrades] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const subs = [];

    subs.push(onSnapshot(doc(db,"users",uid), s => { if(s.exists()) setProfile(s.data()); }));
    subs.push(onSnapshot(
      query(collection(db,"classes"), where("uid","==",uid), where("is_active","==",true)),
      s => setClasses(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"assignments"),
        where("uid","==",uid),
        where("is_completed","==",true),
        where("is_graded","==",true)
      ),
      s => setGradedA(s.docs.map(d=>({id:d.id,...d.data()})))
    ));

    const loadExtras = async () => {
      const wSnap = await getDoc(doc(db,"categoryWeights",uid));
      if (wSnap.exists()) setCategoryWeights(wSnap.data().weights||{});
      const gSnap = await getDoc(doc(db,"gpaScale",uid));
      if (gSnap.exists()) {
        setGlobalScale(gSnap.data().scale||null);
        setMaxGpa(gSnap.data().maxGpa||4.0);
      }
    };
    loadExtras();
    return () => subs.forEach(u=>u());
  }, [user]);

  /* For a given class, resolve its scale then calculate grade + letter */
  const getClassResult = (cls) => {
    const asgns = gradedA.filter(a => a.class_id === cls.id);
    const result = calcClassGrade(asgns, categoryWeights, cls.id);
    if (!result) return null;
    const scale  = resolveScale(cls, globalScale);
    const grade  = getLetter(result.pct, scale);
    return { ...result, grade, scale };
  };

  /* Semester GPA */
  const semesterGpa = useMemo(() => {
    let pts=0, cr=0;
    classes.forEach(cls => {
      const r = getClassResult(cls);
      if (!r || !cls.credit_hours) return;
      pts += r.grade.gpaValue * Number(cls.credit_hours);
      cr  += Number(cls.credit_hours);
    });
    return cr > 0 ? pts/cr : null;
  }, [classes, gradedA, categoryWeights, globalScale]);

  /* Cumulative GPA */
  const cumulativeGpa = useMemo(() => {
    const priorGpa = Number(profile?.current_gpa||0);
    const priorCr  = Number(profile?.completed_credit_hours||0);
    const allGraded = classes.every(cls => getClassResult(cls) !== null);
    if (!allGraded || !classes.length) return priorGpa||null;
    let pts=0, cr=0;
    classes.forEach(cls => {
      const r = getClassResult(cls);
      if (!r || !cls.credit_hours) return;
      pts += r.grade.gpaValue * Number(cls.credit_hours);
      cr  += Number(cls.credit_hours);
    });
    const totalPts = (priorGpa*priorCr)+pts;
    const totalCr  = priorCr+cr;
    return totalCr > 0 ? totalPts/totalCr : priorGpa||null;
  }, [classes, gradedA, profile, categoryWeights, globalScale]);

  /* What-if GPA */
  const whatIfGpa = useMemo(() => {
    if (!whatIfMode) return null;
    const priorGpa = Number(profile?.current_gpa||0);
    const priorCr  = Number(profile?.completed_credit_hours||0);
    let pts=0, cr=0;
    classes.forEach(cls => {
      if (!cls.credit_hours) return;
      const actual = getClassResult(cls);
      const hypo   = whatIfGrades[cls.id];
      let gpaVal;
      if (hypo !== undefined) {
        const scale = resolveScale(cls, globalScale);
        gpaVal = getLetter(hypo, scale).gpaValue;
      } else if (actual) {
        gpaVal = actual.grade.gpaValue;
      } else return;
      pts += gpaVal * Number(cls.credit_hours);
      cr  += Number(cls.credit_hours);
    });
    const tp = (priorGpa*priorCr)+pts;
    const tc = priorCr+cr;
    return tc > 0 ? tp/tc : null;
  }, [whatIfMode, whatIfGrades, classes, gradedA, profile, categoryWeights, globalScale]);

  const totalCredits = classes.reduce((s,c)=>s+Number(c.credit_hours||0),0);

  if (!user) return <div className="gpa-signin">Please sign in to view GPA Calculator</div>;

  return (
    <div className="gpa-calc">
      <div className="gpa-header">
        <div>
          <h1>GPA Calculator</h1>
          <p>Real-time GPA using each class's custom grading scale</p>
        </div>
        <div className="gpa-header-actions">
          <button className={"btn btn-ghost"+(showScale?" active":"")} onClick={()=>setShowScale(v=>!v)}>
            <Info size={15}/> Grade Scale
          </button>
          <button className={"btn btn-ghost"+(whatIfMode?" active":"")}
            onClick={()=>{setWhatIfMode(v=>!v);setWhatIfGrades({});}}>
            <Sliders size={15}/> What-If
          </button>
        </div>
      </div>

      {profile?.current_gpa && (
        <div className="gpa-prior-banner">
          <span>📋</span>
          <span>Starting from <strong>{Number(profile.current_gpa).toFixed(2)} GPA</strong> with{" "}
          <strong>{profile.completed_credit_hours||0} prior credits</strong> — update in Profile.</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="gpa-summary stagger-1">
        <div className="gpa-card gpa-card-main">
          <div className="gpa-card-label">Semester GPA</div>
          <div className="gpa-card-val" style={{color:semesterGpa?gradeColor(semesterGpa,maxGpa):"var(--text-muted)"}}>
            {semesterGpa?semesterGpa.toFixed(2):"—"}
          </div>
          <div className="gpa-card-sub">{gradedA.length} graded assignment{gradedA.length!==1?"s":""}</div>
          {semesterGpa && (
            <div className="gpa-card-bar">
              <div style={{width:(semesterGpa/maxGpa*100)+"%",background:gradeColor(semesterGpa,maxGpa),height:"100%",borderRadius:"3px",transition:"width 0.6s"}}/>
            </div>
          )}
        </div>
        <div className="gpa-card">
          <div className="gpa-card-label">Cumulative GPA</div>
          <div className="gpa-card-val" style={{color:cumulativeGpa?gradeColor(cumulativeGpa,maxGpa):"var(--text-muted)"}}>
            {cumulativeGpa?cumulativeGpa.toFixed(2):"—"}
          </div>
          <div className="gpa-card-sub">
            {classes.every(c=>getClassResult(c))?"Includes current semester":"Grade all classes to update"}
          </div>
          {cumulativeGpa && (
            <div className="gpa-card-bar">
              <div style={{width:(cumulativeGpa/maxGpa*100)+"%",background:gradeColor(cumulativeGpa,maxGpa),height:"100%",borderRadius:"3px",transition:"width 0.6s"}}/>
            </div>
          )}
        </div>
        <div className="gpa-card">
          <div className="gpa-card-label">Current Credits</div>
          <div className="gpa-card-val" style={{color:"var(--text-primary)"}}>{totalCredits}</div>
          <div className="gpa-card-sub">{Number(profile?.completed_credit_hours||0)} prior + {totalCredits} this semester</div>
        </div>
        {whatIfMode && (
          <div className="gpa-card gpa-card-whatif">
            <div className="gpa-card-label">What-If GPA</div>
            <div className="gpa-card-val" style={{color:whatIfGpa?gradeColor(whatIfGpa,maxGpa):"var(--text-muted)"}}>
              {whatIfGpa?whatIfGpa.toFixed(2):"—"}
            </div>
            <div className="gpa-card-sub">Hypothetical scenario</div>
          </div>
        )}
      </div>

      {/* Global scale panel */}
      {showScale && (
        <div className="gpa-scale-panel stagger-2">
          <div className="gpa-scale-header">
            <span>Global Fallback Scale — {globalScale?"Custom":"Default 4.0"}</span>
            <span className="gpa-scale-note">Per-class scales override this. Set in Classes → Grading Scale tab.</span>
          </div>
          <div className="gpa-scale-grid">
            {(globalScale||[
              {letter:"A+",min:97,max:100,gpaValue:4.0},{letter:"A",min:93,max:96.99,gpaValue:4.0},
              {letter:"A-",min:90,max:92.99,gpaValue:3.67},{letter:"B+",min:87,max:89.99,gpaValue:3.33},
              {letter:"B",min:83,max:86.99,gpaValue:3.0},{letter:"B-",min:80,max:82.99,gpaValue:2.67},
              {letter:"C+",min:77,max:79.99,gpaValue:2.33},{letter:"C",min:73,max:76.99,gpaValue:2.0},
              {letter:"C-",min:70,max:72.99,gpaValue:1.67},{letter:"D+",min:67,max:69.99,gpaValue:1.33},
              {letter:"D",min:63,max:66.99,gpaValue:1.0},{letter:"F",min:0,max:62.99,gpaValue:0.0},
            ]).map((row,i)=>(
              <div key={i} className="gpa-scale-row">
                <span className="gpa-scale-letter" style={{color:gradeColor(row.gpaValue,maxGpa)}}>{row.letter}</span>
                <span className="gpa-scale-range">{row.min??row.minPercent}–{row.max??row.maxPercent}%</span>
                <span className="gpa-scale-pts" style={{color:gradeColor(row.gpaValue,maxGpa)}}>{row.gpaValue?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gpa-section-title stagger-2"><BookOpen size={16}/> Class Breakdown</div>

      {classes.length===0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No active classes</h3>
          <p>Add classes and grade assignments to calculate your GPA</p>
        </div>
      ) : (
        <div className="gpa-classes stagger-3">
          {classes.map(cls=>{
            const result = getClassResult(cls);
            const isOpen = expandedClass===cls.id;
            const scale  = resolveScale(cls, globalScale);
            const hasCustomScale = !!(cls.grading_scale?.length);
            const hypo   = whatIfGrades[cls.id];
            const hypoGrd = hypo!==undefined ? getLetter(hypo, scale) : null;

            return (
              <div key={cls.id} className={"gpa-cls-card"+(isOpen?" expanded":"")}
                style={{"--cls-color":cls.color||"#3b82f6"}}>
                <button className="gpa-cls-header"
                  onClick={()=>setExpandedClass(isOpen?null:cls.id)}>
                  <div className="gpa-cls-bar" style={{background:cls.color||"#3b82f6"}}/>
                  <div className="gpa-cls-identity">
                    <span className="gpa-cls-code" style={{color:cls.color||"#3b82f6"}}>{cls.course_code}</span>
                    <span className="gpa-cls-name">{cls.course_name}</span>
                    <span className="gpa-cls-cr">{cls.credit_hours}cr</span>
                    {hasCustomScale && (
                      <span className="gpa-cls-custom-scale" title="Uses class-specific grading scale">📊</span>
                    )}
                  </div>
                  <div className="gpa-cls-grade-wrap">
                    {result ? (
                      <>
                        <span className="gpa-cls-letter" style={{color:pctColor(result.pct)}}>{result.grade.letter}</span>
                        <span className="gpa-cls-pct"   style={{color:pctColor(result.pct)}}>{result.pct.toFixed(1)}%</span>
                        <span className="gpa-cls-gpa">{result.grade.gpaValue.toFixed(2)} pts</span>
                      </>
                    ) : (
                      <span className="gpa-cls-none">No grades</span>
                    )}
                    {whatIfMode && hypoGrd && (
                      <div className="gpa-cls-whatif-pill">
                        <span style={{color:gradeColor(hypoGrd.gpaValue,maxGpa)}}>
                          {hypoGrd.letter} ({hypo}%)
                        </span>
                      </div>
                    )}
                  </div>
                  {isOpen ? <ChevronUp size={15} className="gpa-cls-chevron"/> : <ChevronDown size={15} className="gpa-cls-chevron"/>}
                </button>

                {result && (
                  <div className="gpa-cls-progress">
                    <div style={{width:result.pct+"%",background:pctColor(result.pct),height:"100%",borderRadius:"0",transition:"width 0.5s"}}/>
                  </div>
                )}

                {isOpen && (
                  <div className="gpa-cls-detail">
                    {/* Per-class scale display */}
                    {hasCustomScale && (
                      <div className="gpa-cls-scale-info">
                        <div className="gpa-cat-heading">📊 This Class's Grading Scale</div>
                        <div className="gpa-cls-scale-chips">
  <details className="gpa-scale-collapse">
    <summary className="gpa-scale-summary">
      {/* This is the single-line preview showing just the first item */}
      {cls.grading_scale.filter(r => r.letter).slice(0, 1).map((r, i) => (
        <span 
          key={i} 
          className="gpa-scale-preview-chip main-preview"
          style={{
            color: gradeColor(r.gpaValue, maxGpa),
            borderColor: gradeColor(r.gpaValue, maxGpa) + "44"
          }}
        >
          {r.letter} {r.min}–{r.max}%
        </span>
      ))}
      <span className="toggle-indicator">+{cls.grading_scale.filter(r => r.letter).length - 1} more</span>
    </summary>

    <div className="gpa-scale-expanded-content">
      {/* This shows the rest of the items when clicked, skipping the first one */}
      {cls.grading_scale.filter(r => r.letter).slice(1).map((r, i) => (
        <span 
          key={i} 
          className="gpa-scale-preview-chip"
          style={{
            color: gradeColor(r.gpaValue, maxGpa),
            borderColor: gradeColor(r.gpaValue, maxGpa) + "44"
          }}
        >
          {r.letter} {r.min}–{r.max}%
        </span>
      ))}
    </div>
  </details>
</div>
                      </div>
                    )}

                    {/* What-if slider */}
                    {whatIfMode && (
                      <div className="gpa-whatif-row">
                        <span className="gpa-whatif-label"><Sliders size={13}/> What-If</span>
                        <input type="range" min="0" max="100" className="gpa-whatif-slider"
                          value={hypo??(result?.pct??75)}
                          style={{"--fill":pctColor(hypo??result?.pct??75)}}
                          onChange={e=>setWhatIfGrades(p=>({...p,[cls.id]:Number(e.target.value)}))}/>
                        <span className="gpa-whatif-val" style={{color:pctColor(hypo??result?.pct??75)}}>
                          {hypo!==undefined?hypo:(result?.pct?.toFixed(1)||"—")}%
                        </span>
                        {hypo!==undefined && (
                          <button className="gpa-whatif-reset"
                            onClick={()=>setWhatIfGrades(p=>{const n={...p};delete n[cls.id];return n;})}>
                            Reset
                          </button>
                        )}
                      </div>
                    )}

                    {/* Category breakdown */}
                    {result && Object.keys(result.cats).length>0 && (
                      <div className="gpa-cat-breakdown">
                        <div className="gpa-cat-heading">Category Breakdown</div>
                        {Object.entries(result.cats).map(([cat,data])=>(
                          <div key={cat} className="gpa-cat-row">
                            <span className="gpa-cat-name">{cat}</span>
                            <div className="gpa-cat-bar-track">
                              <div className="gpa-cat-bar-fill" style={{width:data.pct+"%",background:pctColor(data.pct)}}/>
                            </div>
                            <span className="gpa-cat-pct" style={{color:pctColor(data.pct)}}>{data.pct.toFixed(1)}%</span>
                            <span className="gpa-cat-pts">{data.earned.toFixed(0)}/{data.total}</span>
                            {data.weight>0 && <span className="gpa-cat-weight">{data.weight}%</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Target GPA needed */}
                    {profile?.current_gpa && (
                      <div className="gpa-target-section">
                        <div className="gpa-cat-heading"><Target size={13}/> Grade Needed to Hit Target GPA</div>
                        <div className="gpa-targets">
                          {[3.0,3.3,3.5,3.7,4.0].filter(t=>t<=maxGpa).map(target=>{
                            const priorGpa=Number(profile.current_gpa||0);
                            const priorCr =Number(profile.completed_credit_hours||0);
                            const cr=Number(cls.credit_hours||0);
                            if(!cr)return null;
                            const needed=((target*(priorCr+cr))-(priorGpa*priorCr))/cr;
                            const neededPct=Math.max(0,Math.min(100,(needed/maxGpa)*100));
                            const neededLetter=getLetter(neededPct,scale);
                            return (
                              <div key={target} className="gpa-target-row">
                                <span className="gpa-target-label">{target.toFixed(1)} GPA</span>
                                <span className="gpa-target-val" style={{color:gradeColor(needed,maxGpa)}}>
                                  {neededLetter.letter} (≥{neededPct.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!result && (
                      <div className="gpa-no-grades-msg">
                        No graded assignments yet — head to Grade Tracker to enter grades.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
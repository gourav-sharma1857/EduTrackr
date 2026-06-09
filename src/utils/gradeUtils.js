/**
 * gradeUtils.js — single source of truth for credits + GPA across all pages.
 *
 * CREDIT RULES (consistent everywhere):
 *  completedCredits  = archived non-transfer classes (any, regardless of final grade)
 *                    + semester planner courses status="Completed" (non-transfer)
 *                    + manual req entries status="Completed" / is_completed (non-transfer)
 *  transferCredits   = any class/course/req with is_transfer OR status="Transferred"
 *  totalForDegree    = completedCredits + transferCredits
 *  inProgressCredits = active (non-archived) classes
 *
 * GPA RULES:
 *  Only non-transfer archived classes WITH a final_grade_pct contribute to GPA.
 *  Transfer credits never affect GPA.
 *  Profile prior GPA is used ONLY when zero archived class data exists yet.
 */

export const GLOBAL_DEFAULT_SCALE = [
  { letter:"A+", min:97,  max:100,   gpaValue:4.0  },
  { letter:"A",  min:93,  max:96.99, gpaValue:4.0  },
  { letter:"A-", min:90,  max:92.99, gpaValue:3.67 },
  { letter:"B+", min:87,  max:89.99, gpaValue:3.33 },
  { letter:"B",  min:83,  max:86.99, gpaValue:3.0  },
  { letter:"B-", min:80,  max:82.99, gpaValue:2.67 },
  { letter:"C+", min:77,  max:79.99, gpaValue:2.33 },
  { letter:"C",  min:73,  max:76.99, gpaValue:2.0  },
  { letter:"C-", min:70,  max:72.99, gpaValue:1.67 },
  { letter:"D+", min:67,  max:69.99, gpaValue:1.33 },
  { letter:"D",  min:63,  max:66.99, gpaValue:1.0  },
  { letter:"D-", min:60,  max:62.99, gpaValue:0.67 },
  { letter:"F",  min:0,   max:59.99, gpaValue:0.0  },
];

export function resolveScale(cls, globalScale) {
  if (cls?.grading_scale?.length) return cls.grading_scale;
  if (globalScale?.length)        return globalScale;
  return GLOBAL_DEFAULT_SCALE;
}

export function getLetter(pct, scale) {
  const s = scale?.length ? scale : GLOBAL_DEFAULT_SCALE;
  for (const row of s) {
    const lo = row.min ?? row.minPercent ?? 0;
    const hi = row.max ?? row.maxPercent ?? 100;
    if (pct >= lo && pct <= hi) return { letter: row.letter, gpaValue: row.gpaValue ?? 0 };
  }
  const sorted = [...s].sort((a,b)=>(a.min??a.minPercent??0)-(b.min??b.minPercent??0));
  return { letter: sorted[0]?.letter ?? "F", gpaValue: sorted[0]?.gpaValue ?? 0 };
}

export function gradeColor(gpaValue, maxGpa = 4.0) {
  const r = maxGpa > 0 ? gpaValue / maxGpa : 0;
  if (r >= 0.875) return "#10b981";
  if (r >= 0.75)  return "#3b82f6";
  if (r >= 0.625) return "#f59e0b";
  if (r >= 0.5)   return "#f97316";
  return "#ef4444";
}

export function pctColor(pct) {
  if (pct >= 90) return "#10b981";
  if (pct >= 80) return "#3b82f6";
  if (pct >= 70) return "#f59e0b";
  if (pct >= 60) return "#f97316";
  return "#ef4444";
}

export function calcClassGrade(assignments, weights, classId) {
  if (!assignments.length) return null;
  const cats = {};
  assignments.forEach(a => {
    const c = a.category || "Other";
    if (!cats[c]) cats[c] = { total:0, earned:0, weight: weights[`${classId}_${c}`]||0 };
    cats[c].total  += Number(a.total_points  || 0);
    cats[c].earned += Number(a.earned_points || 0);
  });
  Object.values(cats).forEach(c => { c.pct = c.total > 0 ? (c.earned/c.total)*100 : 0; });
  const totalWeight = Object.values(cats).reduce((s,c)=>s+c.weight, 0);
  let finalPct;
  if (totalWeight > 0 && totalWeight <= 100) {
    const ws = Object.values(cats).reduce((s,c)=>s+(c.pct*(c.weight/100)), 0);
    finalPct = (ws/totalWeight)*100;
  } else {
    const tp = assignments.reduce((s,a)=>s+Number(a.total_points||0),  0);
    const ep = assignments.reduce((s,a)=>s+Number(a.earned_points||0), 0);
    finalPct = tp > 0 ? (ep/tp)*100 : 0;
  }
  return { pct: finalPct, cats, count: assignments.length };
}

/**
 * THE one function every page calls.
 * Pass whatever data you have — missing arrays are treated as empty.
 */
export function computeAllStats({
  allClasses        = [],
  semesters         = [],
  coreReqs          = [],
  majorReqs         = [],
  minorReqs         = [],
  profile           = {},
  gradedAssignments = [],
  categoryWeights   = {},
  globalScale       = null,
}) {
  const activeClasses   = allClasses.filter(c =>  c.is_active);
  const archivedClasses = allClasses.filter(c => !c.is_active);

  /* De-duplication maps */
  const completedMap = new Map();
  const transferMap  = new Map();
  const addC = (k, cr) => { if (!completedMap.has(k)) completedMap.set(k, Number(cr)||0); };
  const addT = (k, cr) => { if (!transferMap.has(k))  transferMap.set(k,  Number(cr)||0); };

  /* ── 1. Archived classes ───────────────────────────────── */
  archivedClasses.forEach(cls => {
    const cr = Number(cls.credit_hours || 0);
    if (!cr) return;
    cls.is_transfer ? addT(`arch_${cls.id}`, cr) : addC(`arch_${cls.id}`, cr);
  });

  /* ── 2. Semester planner courses ───────────────────────── */
  semesters.forEach(sem => {
    (sem.courses || []).forEach(c => {
      const cr  = Number(c.credit_hours || 0);
      const key = `sem_${sem.id}_${c.id||c.course_code}`;
      // Don't double-count if this course came from an archived class
      const alreadyCounted = archivedClasses.some(a =>
        a.course_code === c.course_code && a.semester === sem.name
      );
      if (alreadyCounted) return;
      if (c.status === "Transferred" || c.is_transfer) addT(key, cr);
      else if (c.status === "Completed") addC(key, cr);
    });
  });

  /* ── 3. Manual requirement entries ─────────────────────── */
  [...coreReqs, ...majorReqs, ...minorReqs].forEach(c => {
    const cr  = Number(c.credit_hours || 0);
    const key = `req_${c.id}`;
    if (c.status === "Transferred" || c.is_transfer) addT(key, cr);
    else if (c.status === "Completed" || c.is_completed) addC(key, cr);
  });

  const completedCredits = Array.from(completedMap.values()).reduce((a,b)=>a+b, 0);
  const transferCredits  = Array.from(transferMap.values()).reduce((a,b)=>a+b,  0);
  const totalForDegree   = completedCredits + transferCredits;
  const inProgressCredits = activeClasses.reduce((s,c)=>s+Number(c.credit_hours||0), 0);

  const degreeReq      = Number(profile?.degree_credit_requirement || 120);
  const degreeProgress = degreeReq > 0 ? Math.min((totalForDegree / degreeReq) * 100, 100) : 0;
  const remaining      = Math.max(0, degreeReq - totalForDegree - inProgressCredits);

  /* ── GPA: archived non-transfer with final_grade_pct ───── */
  let archGpaPts = 0, archGpaCr = 0;
  archivedClasses.forEach(cls => {
    if (cls.is_transfer) return;
    if (cls.final_grade_pct == null) return;
    const cr = Number(cls.credit_hours || 0);
    if (!cr) return;
    const scale = resolveScale(cls, globalScale);
    const { gpaValue } = getLetter(Number(cls.final_grade_pct), scale);
    archGpaPts += gpaValue * cr;
    archGpaCr  += cr;
  });

  /* ── GPA: active classes via graded assignments ─────────── */
  let semGpaPts = 0, semGpaCr = 0;
  activeClasses.forEach(cls => {
    const asgns  = gradedAssignments.filter(a => a.class_id === cls.id);
    const result = calcClassGrade(asgns, categoryWeights, cls.id);
    if (!result || !cls.credit_hours) return;
    const scale  = resolveScale(cls, globalScale);
    const { gpaValue } = getLetter(result.pct, scale);
    semGpaPts += gpaValue * Number(cls.credit_hours);
    semGpaCr  += Number(cls.credit_hours);
  });

  const semesterGpa = semGpaCr > 0 ? semGpaPts / semGpaCr : null;

  /* Cumulative — fold in profile prior ONLY when no archived data yet */
  let totalGpaPts = archGpaPts + semGpaPts;
  let totalGpaCr  = archGpaCr  + semGpaCr;
  const priorGpa = Number(profile?.current_gpa || 0);
  const priorCr  = Number(profile?.completed_credit_hours || 0);
  if (archGpaCr === 0 && priorGpa > 0 && priorCr > 0) {
    totalGpaPts += priorGpa * priorCr;
    totalGpaCr  += priorCr;
  }
  const cumulativeGpa = totalGpaCr > 0 ? totalGpaPts / totalGpaCr : (priorGpa || null);

  return {
    /* credits */
    completedCredits,
    transferCredits,
    totalForDegree,
    inProgressCredits,
    remaining,
    /* degree */
    degreeReq,
    degreeProgress,
    /* gpa */
    semesterGpa,
    cumulativeGpa,
    archGpaCr,
  };
}
/**
 * gradeUtils.js — shared grade helpers for GradeTracker & GpaCalculator.
 * Per-class grading_scale (set in Classes page) takes priority over the
 * global gpaScale doc, which takes priority over the 4.0 default.
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

/** Pick the best scale for a class (class-specific > global > default) */
export function resolveScale(cls, globalScale) {
  if (cls?.grading_scale?.length) return cls.grading_scale;
  if (globalScale?.length)        return globalScale;
  return GLOBAL_DEFAULT_SCALE;
}

/** Convert pct → { letter, gpaValue } using whichever scale is provided */
export function getLetter(pct, scale) {
  const s = scale?.length ? scale : GLOBAL_DEFAULT_SCALE;
  for (const row of s) {
    const lo = row.min  ?? row.minPercent ?? 0;
    const hi = row.max  ?? row.maxPercent ?? 100;
    if (pct >= lo && pct <= hi) return { letter: row.letter, gpaValue: row.gpaValue ?? 0 };
  }
  const sorted = [...s].sort((a,b) => (a.min??a.minPercent??0) - (b.min??b.minPercent??0));
  return { letter: sorted[0]?.letter ?? "F", gpaValue: sorted[0]?.gpaValue ?? 0 };
}

/** GPA point → color */
export function gradeColor(gpaValue, maxGpa = 4.0) {
  const r = maxGpa > 0 ? gpaValue / maxGpa : 0;
  if (r >= 0.875) return "#10b981";
  if (r >= 0.75)  return "#3b82f6";
  if (r >= 0.625) return "#f59e0b";
  if (r >= 0.5)   return "#f97316";
  return "#ef4444";
}

/** Raw percentage → color */
export function pctColor(pct) {
  if (pct >= 90) return "#10b981";
  if (pct >= 80) return "#3b82f6";
  if (pct >= 70) return "#f59e0b";
  if (pct >= 60) return "#f97316";
  return "#ef4444";
}

/**
 * Calculate weighted/point-based grade for one class.
 * Returns { pct, cats, count } or null if no assignments.
 */
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

  const totalWeight = Object.values(cats).reduce((s,c) => s+c.weight, 0);
  let finalPct;
  if (totalWeight > 0 && totalWeight <= 100) {
    const ws = Object.values(cats).reduce((s,c) => s+(c.pct*(c.weight/100)), 0);
    finalPct = (ws / totalWeight) * 100;
  } else {
    const tp = assignments.reduce((s,a) => s+Number(a.total_points||0),  0);
    const ep = assignments.reduce((s,a) => s+Number(a.earned_points||0), 0);
    finalPct = tp > 0 ? (ep/tp)*100 : 0;
  }
  return { pct: finalPct, cats, count: assignments.length };
}
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

/* Shared helpers (imported by the widgets and the planner grid) */
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const toMin = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export const label = (m) => {
  const h = Math.floor(m / 60),
    mm = m % 60;
  return `${h % 12 || 12}${mm ? ":" + pad(mm) : ""}${h < 12 ? "am" : "pm"}`;
};
export const fmtClock = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const DEFAULTS = { focus: 25, short: 5, long: 15 };
const Ctx = createContext(null);
export const useFocus = () => useContext(Ctx);

function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)(),
      o = c.createOscillator(),
      g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
    o.start();
    o.stop(c.currentTime + 1.2);
  } catch (e) {}
}

/* Wrap your app in <FocusProvider> so the timer keeps running while you move between pages. */
export function FocusProvider({ children }) {
  const [user, setUser] = useState(null);
  const [blocks, setBlocks] = useState([]); // collection: study_blocks
  const [sessions, setSessions] = useState([]); // collection: focus_sessions
  const [settings, setSettings] = useState(() => {
    try {
      return {
        ...DEFAULTS,
        ...JSON.parse(localStorage.getItem("focus.settings") || "{}"),
      };
    } catch (e) {
      return DEFAULTS;
    }
  });
  const [mode, setMode] = useState("focus");
  const [target, setTarget] = useState(null); // { blockId?, title, source_type, source_id }
  const [endAt, setEndAt] = useState(null);
  const [remaining, setRemaining] = useState(settings.focus * 60);
  const [total, setTotal] = useState(settings.focus * 60);
  const [now, setNow] = useState(Date.now());
  const cycle = useRef(0);
  const finishing = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setBlocks([]);
      setSessions([]);
      return;
    }
    const q = (c) => query(collection(db, c), where("uid", "==", user.uid));
    const u1 = onSnapshot(q("study_blocks"), (s) =>
      setBlocks(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    const u2 = onSnapshot(q("focus_sessions"), (s) =>
      setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return () => {
      u1();
      u2();
    };
  }, [user]);

  const saveBlock = useCallback(
    async (b) => {
      const { id, ...data } = b;
      if (id) {
        await updateDoc(doc(db, "study_blocks", id), data);
        return id;
      }
      const r = await addDoc(collection(db, "study_blocks"), {
        ...data,
        uid: user.uid,
        created_at: new Date().toISOString(),
      });
      return r.id;
    },
    [user],
  );
  const removeBlock = useCallback(
    (id) => deleteDoc(doc(db, "study_blocks", id)),
    [],
  );

  const enter = useCallback(
    (m, run = false) => {
      const long = cycle.current > 0 && cycle.current % 4 === 0;
      const s =
        (m === "focus"
          ? settings.focus
          : long
            ? settings.long
            : settings.short) * 60;
      setMode(m);
      setTotal(s);
      setRemaining(s);
      setNow(Date.now());
      setEndAt(run ? Date.now() + s * 1000 : null);
    },
    [settings],
  );

  const live = useRef({});
  live.current = { mode, target, blocks, user, settings, enter };

  const complete = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    const { mode, target, blocks, user, settings, enter } = live.current;
    setEndAt(null);
    beep();
    try {
      if (mode === "focus") {
        cycle.current++;
        await addDoc(collection(db, "focus_sessions"), {
          uid: user.uid,
          date: ymd(new Date()),
          mins: settings.focus,
          title: target?.title || "Focus",
          source_type: target?.source_type || "",
          source_id: target?.source_id || "",
          block_id: target?.blockId || "",
          created_at: new Date().toISOString(),
        });
        const b =
          target?.blockId && blocks.find((x) => x.id === target.blockId);
        if (b)
          await updateDoc(doc(db, "study_blocks", b.id), {
            pomos: (b.pomos || 0) + 1,
          });
      }
      if ("Notification" in window && Notification.permission === "granted")
        new Notification(
          mode === "focus"
            ? "Focus session done. Take a break."
            : "Break over. Time to lock in.",
        );
    } catch (e) {
      console.error("Could not log session", e);
    }
    enter(mode === "focus" ? "break" : "focus");
    finishing.current = false;
  }, []);

  useEffect(() => {
    if (!endAt) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= endAt) complete();
    }, 500);
    return () => clearInterval(t);
  }, [endAt, complete]);

  const left = endAt ? Math.max(0, (endAt - now) / 1000) : remaining;
  const running = !!endAt;
  const today = ymd(new Date());
  const todaySessions = sessions.filter((s) => s.date === today);

  const value = {
    user,
    blocks,
    saveBlock,
    removeBlock,
    settings,
    mode,
    target,
    left,
    total,
    running,
    todayCount: todaySessions.length,
    todayMins: todaySessions.reduce((a, s) => a + (s.mins || 0), 0),
    start: () => {
      if (endAt) return;
      setEndAt(Date.now() + remaining * 1000);
      setNow(Date.now());
      if ("Notification" in window && Notification.permission === "default")
        Notification.requestPermission();
    },
    pause: () => {
      if (endAt) {
        setRemaining((endAt - Date.now()) / 1000);
        setEndAt(null);
      }
    },
    reset: () => enter(mode),
    skip: () => {
      if (mode === "focus") cycle.current++;
      enter(mode === "focus" ? "break" : "focus");
    },
    focusOn: (t) => {
      setTarget(t);
      enter("focus", true);
    },
    updateSettings: (patch) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      localStorage.setItem("focus.settings", JSON.stringify(next));
      if (!endAt && mode === "focus" && patch.focus) {
        setRemaining(patch.focus * 60);
        setTotal(patch.focus * 60);
      }
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

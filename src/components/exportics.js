/* Builds an iCalendar (.ics) file that Google Calendar and Apple Calendar can import.
   Times are written as "floating" local times, so events land at the same clock time in whatever
   time zone the importing calendar is set to. */

const p2 = (n) => String(n).padStart(2, "0");
const dateOnly = (d) =>
  `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
const localStamp = (d) =>
  `${dateOnly(d)}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
const stamp = (dateStr, mins) =>
  `${dateStr.replace(/-/g, "")}T${p2(Math.floor(mins / 60))}${p2(mins % 60)}00`;
const utcNow = () =>
  new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toMin = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

const esc = (t) =>
  String(t || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/* RFC 5545: lines must be folded at 75 octets */
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = "",
    bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 73) {
      out.push(cur);
      cur = " " + ch;
      bytes = 1 + n;
    } else {
      cur += ch;
      bytes += n;
    }
  }
  out.push(cur);
  return out.join("\r\n");
}

const IDX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};
const BY = {
  Sunday: "SU",
  Monday: "MO",
  Tuesday: "TU",
  Wednesday: "WE",
  Thursday: "TH",
  Friday: "FR",
  Saturday: "SA",
};

const alarm = (trigger) => [
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:Reminder",
  `TRIGGER:${trigger}`,
  "END:VALARM",
];

export function buildIcs({
  classes = [],
  blocks = [],
  assignments = [],
  todos = [],
  applications = [],
  include,
  termStart,
  termEnd,
}) {
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EduTrackr//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:EduTrackr",
  ];
  const now = utcNow();
  const event = (uid, lines) => {
    L.push(
      "BEGIN:VEVENT",
      `UID:${uid}@edutrackr`,
      `DTSTAMP:${now}`,
      ...lines,
      "END:VEVENT",
    );
  };

  /* 1. Classes: one weekly-repeating event per class, between termStart and termEnd */
  if (include.classes) {
    const start = parseDay(termStart),
      until = `${termEnd.replace(/-/g, "")}T235959`;
    classes.forEach((c) => {
      const days = (c.days || []).filter((d) => d in IDX);
      if (!c.start_time || !c.end_time || !days.length) return;
      let first = null;
      for (let i = 0; i < 7 && !first; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if (days.some((n) => IDX[n] === d.getDay())) first = d;
      }
      if (!first) return;
      const ds = `${first.getFullYear()}-${p2(first.getMonth() + 1)}-${p2(first.getDate())}`;
      event("class-" + c.id, [
        `SUMMARY:${esc([c.course_code, c.course_name || c.name].filter(Boolean).join(" · ") || "Class")}`,
        `DTSTART:${stamp(ds, toMin(c.start_time))}`,
        `DTEND:${stamp(ds, toMin(c.end_time))}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BY[d]).join(",")};UNTIL=${until}`,
        ...(c.location ? [`LOCATION:${esc(c.location)}`] : []),
        ...(c.professor || c.instructor
          ? [
              `DESCRIPTION:${esc("Instructor: " + (c.professor || c.instructor))}`,
            ]
          : []),
      ]);
    });
  }

  /* 2. Your study blocks (single events) */
  if (include.blocks) {
    blocks.forEach((b) => {
      if (!b.date || b.end <= b.start) return;
      const cls = classes.find((c) => c.id === b.class_id);
      event("block-" + b.id, [
        `SUMMARY:${esc("Study: " + b.title)}`,
        `DTSTART:${stamp(b.date, b.start)}`,
        `DTEND:${stamp(b.date, b.end)}`,
        `DESCRIPTION:${esc([cls && (cls.course_code || cls.name), b.pomos ? b.pomos + " focus sessions done" : "", b.done ? "Completed" : ""].filter(Boolean).join(" · "))}`,
      ]);
    });
  }

  /* 3. Deadlines: assignments, to-dos, interviews */
  if (include.deadlines) {
    const due = (uid, title, when, cls) => {
      const d = new Date(when);
      if (isNaN(d)) return;
      const e = new Date(d.getTime() + 30 * 60000);
      event(uid, [
        `SUMMARY:${esc("Due: " + title + (cls ? ` (${cls})` : ""))}`,
        `DTSTART:${localStamp(d)}`,
        `DTEND:${localStamp(e)}`,
        ...alarm("-PT1H"),
      ]);
    };
    assignments.forEach((a) => {
      if (a.due_date)
        due(
          "asg-" + a.id,
          a.title,
          a.due_date,
          classes.find((c) => c.id === a.class_id)?.course_code,
        );
    });
    todos.forEach((t) => {
      if (t.due_date) due("todo-" + t.id, t.title, t.due_date, "");
    });
    applications.forEach((app) => {
      if (!app.interview_date) return;
      const base = new Date(app.interview_date);
      if (isNaN(base)) return;
      const title = `Interview: ${[app.company_organization, app.position].filter(Boolean).join(" – ")}`;
      const m = /^(\d{1,2}):(\d{2})/.exec(app.interview_time || "");
      if (m) {
        base.setHours(+m[1], +m[2], 0, 0);
        const e = new Date(base.getTime() + 60 * 60000);
        event("int-" + app.id, [
          `SUMMARY:${esc(title)}`,
          `DTSTART:${localStamp(base)}`,
          `DTEND:${localStamp(e)}`,
          ...alarm("-PT1H"),
        ]);
      } else {
        const next = new Date(base);
        next.setDate(next.getDate() + 1);
        event("int-" + app.id, [
          `SUMMARY:${esc(title)}`,
          `DTSTART;VALUE=DATE:${dateOnly(base)}`,
          `DTEND;VALUE=DATE:${dateOnly(next)}`,
        ]);
      }
    });
  }

  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(text, filename = "edutrackr-calendar.ics") {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

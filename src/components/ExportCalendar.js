import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";
import { buildIcs, downloadIcs } from "../components/exportics";
import "../styles/Focus.css";

/* Drop into the calendar toolbar:
   <ExportCalendar classes={classes} blocks={studyBlocks} assignments={assignments} todos={todos} applications={applications} /> */
export default function ExportCalendar({
  classes,
  blocks,
  assignments,
  todos,
  applications,
}) {
  const [open, setOpen] = useState(false);
  const [inc, setInc] = useState({ blocks: true, deadlines: true }); // classes are never exported
  const [err, setErr] = useState("");

  const toggle = (k) => setInc((v) => ({ ...v, [k]: !v[k] }));

  const run = () => {
    if (!inc.blocks && !inc.deadlines)
      return setErr("Pick at least one thing to export.");
    setErr("");
    downloadIcs(
      buildIcs({
        classes,
        blocks,
        assignments,
        todos,
        applications,
        include: inc,
      }),
    );
    setOpen(false);
  };

  return (
    <>
      <button
        className="cal-today-btn"
        onClick={() => setOpen(true)}
        title="Export to Google or Apple Calendar"
      >
        <Download size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Export
      </button>
      {open &&
        createPortal(
          <div className="fk-overlay" onClick={() => setOpen(false)}>
            <div
              className="fk-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Export calendar"
            >
              <h3>Export calendar</h3>
              <p className="fk-sub">
                Downloads an .ics file for Google Calendar or Apple Calendar.
                Class meetings are not included.
              </p>

              <label className="fk-inline">
                <input
                  type="checkbox"
                  checked={inc.blocks}
                  onChange={() => toggle("blocks")}
                />
                My study blocks ({blocks.length})
              </label>
              <label className="fk-inline">
                <input
                  type="checkbox"
                  checked={inc.deadlines}
                  onChange={() => toggle("deadlines")}
                />
                Deadlines and interviews (
                {assignments.length +
                  todos.length +
                  applications.filter((a) => a.interview_date).length}
                )
              </label>

              {err && (
                <p className="fk-err" role="alert">
                  {err}
                </p>
              )}

              <details className="fk-tp-set">
                <summary>How to import it</summary>
                <p>
                  <b>Google Calendar:</b> on a computer, open
                  calendar.google.com, click the gear, choose Settings, then
                  Import &amp; export, pick the file, and choose which calendar
                  to add it to. (The phone app can't import files.)
                </p>
                <p>
                  <b>Apple Calendar:</b> double-click the file, or drag it into
                  Calendar, and choose which calendar to add it to.
                </p>
                <p>
                  Tip: import into a new calendar called "EduTrackr" so you can
                  delete or re-import it cleanly.
                </p>
              </details>

              <div className="fk-row fk-end">
                <button className="fk-btn" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="fk-btn fk-primary" onClick={run}>
                  <Download size={13} /> Download .ics
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

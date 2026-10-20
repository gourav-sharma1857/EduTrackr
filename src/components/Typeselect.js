import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Category / type dropdown with "＋ New custom type…".
 * Custom types live in the same `assignment_types` collection the Assignments page uses,
 * so a type you add here shows up there (and the other way round).
 *
 *   <TypeSelect value={cat} onChange={setCat} classId={classId} uid={user?.uid} categories={CATEGORIES} />
 */
const line = "1px solid var(--border, rgba(148,163,184,.3))";

export default function TypeSelect({
  value,
  onChange,
  classId,
  uid,
  categories,
}) {
  const [custom, setCustom] = useState([]);
  const [adding, setAdding] = useState(null); // null = closed, else { name, classOnly }

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "assignment_types"), where("uid", "==", uid)),
      (s) => setCustom(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
  }, [uid]);

  const visible = custom.filter((t) => !t.class_id || t.class_id === classId);
  const options = [...new Set([...categories, ...visible.map((t) => t.name)])];

  const add = async () => {
    const name = (adding?.name || "").trim();
    if (!name || !uid) return;
    const existing = options.find(
      (n) => n.toLowerCase() === name.toLowerCase(),
    );
    if (!existing) {
      await addDoc(collection(db, "assignment_types"), {
        uid,
        name,
        class_id: adding.classOnly && classId ? classId : "",
        created_at: new Date().toISOString(),
      });
    }
    onChange(existing || name);
    setAdding(null);
  };

  return (
    <>
      <select
        className="form-control"
        value={value}
        onChange={(e) =>
          e.target.value === "__new__"
            ? setAdding({ name: "", classOnly: false })
            : onChange(e.target.value)
        }
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        {!options.includes(value) && <option value={value}>{value}</option>}
        <option value="__new__">＋ New custom type…</option>
      </select>

      {adding && (
        <div
          style={{ marginTop: 8, padding: 10, borderRadius: 10, border: line }}
        >
          <input
            className="form-control"
            autoFocus
            maxLength={30}
            placeholder="e.g. Discussion post, Reading, Presentation"
            value={adding.name}
            onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <label
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              fontSize: ".82rem",
              margin: "8px 0",
            }}
          >
            <input
              type="checkbox"
              disabled={!classId}
              checked={adding.classOnly}
              onChange={(e) =>
                setAdding((a) => ({ ...a, classOnly: e.target.checked }))
              }
            />
            {classId
              ? "Only for this class"
              : "Pick a class first to limit it to one class"}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={add}>
              Add type
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAdding(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
        >
          {visible.map((t) => (
            <span
              key={t.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: ".74rem",
                padding: "2px 8px",
                borderRadius: 999,
                border: line,
              }}
            >
              {t.name}
              {t.class_id ? " · this class" : ""}
              <button
                type="button"
                aria-label={"Delete type " + t.name}
                title="Delete this type (existing grades keep it)"
                onClick={() => deleteDoc(doc(db, "assignment_types", t.id))}
                style={{
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  color: "inherit",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

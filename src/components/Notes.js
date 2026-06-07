import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Search, Trash2, Edit2, Tag, X,
  Download, BookOpen, Clock, Hash, ChevronDown, ChevronUp,
  StickyNote, FileText
} from "lucide-react";
import "../styles/Notes.css";

export default function Notes() {
  const [user, setUser]             = useState(null);
  const [notes, setNotes]           = useState([]);
  const [classes, setClasses]       = useState([]);
  const [search, setSearch]         = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterTag, setFilterTag]   = useState("");
  const [viewingNote, setViewingNote] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [tagInput, setTagInput]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [expandedClasses, setExpandedClasses] = useState({});

  const blankForm = {
    class_id:"", title:"", content:"",
    lecture_date:"", tags:[]
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
    const uid = user.uid;
    const subs = [];

    subs.push(onSnapshot(
      query(collection(db,"classes"), where("uid","==",uid)),
      s => setClasses(s.docs.map(d=>({id:d.id,...d.data()})))
    ));
    subs.push(onSnapshot(
      query(collection(db,"notes"), where("uid","==",uid)),
      s => setNotes(s.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)))
    ));

    return () => subs.forEach(u => u());
  }, [user]);

  /* ── All tags across all notes ── */
  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach(n => (n.tags||[]).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  /* ── Filtered notes ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter(n => {
      const matchSearch = !q ||
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q) ||
        (n.tags||[]).some(t => t.toLowerCase().includes(q));
      const matchClass = filterClass==="all" || n.class_id===filterClass;
      const matchTag   = !filterTag || (n.tags||[]).includes(filterTag);
      return matchSearch && matchClass && matchTag;
    });
  }, [notes, search, filterClass, filterTag]);

  /* ── Group filtered notes by class ── */
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(n => {
      const cls = classes.find(c => c.id === n.class_id);
      const key = cls?.id || "general";
      if (!map[key]) map[key] = { cls, notes:[] };
      map[key].notes.push(n);
    });
    return map;
  }, [filtered, classes]);

  /* Auto-expand groups */
  useEffect(() => {
    const next = {};
    Object.keys(grouped).forEach(k => {
      if (expandedClasses[k] === undefined) next[k] = true;
    });
    if (Object.keys(next).length)
      setExpandedClasses(p => ({...p,...next}));
  }, [grouped]);

  /* ── CRUD ── */
  const openAdd = () => {
    setForm(blankForm);
    setEditingNote(null);
    setTagInput("");
    setIsModalOpen(true);
  };

  const openEdit = (note) => {
    setEditingNote(note);
    setForm({
      class_id:     note.class_id||"",
      title:        note.title||"",
      content:      note.content||"",
      lecture_date: note.lecture_date||"",
      tags:         note.tags||[],
    });
    setTagInput("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setTagInput("");
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingNote) {
        await updateDoc(doc(db,"notes",editingNote.id), {
          ...form, updated_at: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db,"notes"), {
          ...form, uid: user.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      closeModal();
    } catch(err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db,"notes",deleteTarget.id));
    if (viewingNote?.id === deleteTarget.id) setViewingNote(null);
    setDeleteTarget(null);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g,"-");
    if (t && !form.tags.includes(t)) {
      setForm(f => ({...f, tags:[...f.tags, t]}));
    }
    setTagInput("");
  };

  const removeTag = tag =>
    setForm(f => ({...f, tags: f.tags.filter(t=>t!==tag)}));

  /* ── Export as text ── */
  const exportNote = (note) => {
    const cls  = classes.find(c => c.id === note.class_id);
    const text = [
      note.title,
      cls ? `Course: ${cls.course_code} — ${cls.course_name}` : "",
      note.lecture_date ? `Date: ${note.lecture_date}` : "",
      "",
      note.content,
      "",
      note.tags?.length ? `Tags: ${note.tags.map(t=>"#"+t).join(" ")}` : "",
    ].filter(l => l !== undefined).join("\n");

    const blob = new Blob([text], {type:"text/plain"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/\s+/g,"-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = ds => {
    if (!ds) return "";
    const [y,m,d] = ds.split("-").map(Number);
    return new Date(y,m-1,d).toLocaleDateString("en-US",{
      month:"long", day:"numeric", year:"numeric"
    });
  };

  const toggleGroup = key =>
    setExpandedClasses(p => ({...p,[key]:!p[key]}));

  if (!user) return (
    <div className="notes-signin">Please sign in to view notes</div>
  );

  return (
    <div className="notes-page">
      {/* ── Header ── */}
      <div className="notes-header">
        <div>
          <h1>Notes</h1>
          <p>Capture and review your lecture notes</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16}/> New Note
        </button>
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="notes-toolbar">
        <div className="notes-search-wrap">
          <Search size={15} className="notes-search-icon"/>
          <input
            className="notes-search"
            placeholder="Search notes, content, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="notes-search-clear" onClick={()=>setSearch("")}>
              <X size={13}/>
            </button>
          )}
        </div>

        <select
          className="notes-filter-select"
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
        >
          <option value="all">All Classes</option>
          {classes.map(c=>(
            <option key={c.id} value={c.id}>{c.course_code}</option>
          ))}
        </select>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="notes-tag-filters">
            {allTags.slice(0,6).map(tag=>(
              <button
                key={tag}
                className={"notes-tag-chip"+(filterTag===tag?" active":"")}
                onClick={()=>setFilterTag(filterTag===tag?"":tag)}
              >
                <Hash size={10}/>{tag}
              </button>
            ))}
            {filterTag && (
              <button className="notes-tag-chip clear" onClick={()=>setFilterTag("")}>
                <X size={10}/> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="notes-stats">
        <span className="notes-stat">
          <StickyNote size={13}/> {notes.length} total
        </span>
        {search || filterClass!=="all" || filterTag ? (
          <span className="notes-stat filtered">
            {filtered.length} matching
          </span>
        ) : null}
      </div>

      {/* ── Notes grouped by class ── */}
      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>{notes.length===0 ? "No notes yet" : "No notes match your filters"}</h3>
          <p>{notes.length===0 ? "Add your first note to start building your knowledge base" : "Try adjusting your search or filters"}</p>
          {notes.length===0 && (
            <button className="btn btn-primary" style={{marginTop:"1rem"}} onClick={openAdd}>
              <Plus size={15}/> Create First Note
            </button>
          )}
        </div>
      ) : (
        <div className="notes-groups">
          {Object.entries(grouped).map(([key, {cls, notes:clsNotes}])=>{
            const isOpen = expandedClasses[key] !== false;
            return (
              <div key={key} className="notes-group">
                {/* Group header */}
                <button
                  className="notes-group-header"
                  style={{borderLeftColor: cls?.color||"#6366f1"}}
                  onClick={()=>toggleGroup(key)}
                >
                  <div className="notes-group-identity">
                    {cls ? (
                      <>
                        <span className="notes-group-code" style={{color:cls.color||"#818cf8"}}>
                          {cls.course_code}
                        </span>
                        <span className="notes-group-name">{cls.course_name}</span>
                      </>
                    ) : (
                      <span className="notes-group-code" style={{color:"var(--text-muted)"}}>
                        General
                      </span>
                    )}
                  </div>
                  <div className="notes-group-right">
                    <span className="notes-group-count">{clsNotes.length}</span>
                    {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </div>
                </button>

                {/* Note cards grid */}
                {isOpen && (
                  <div className="notes-cards-grid">
                    {clsNotes.map(note=>(
                      <div
                        key={note.id}
                        className="note-card"
                        style={{"--note-color": cls?.color||"#6366f1"}}
                        onClick={()=>setViewingNote(note)}
                      >
                        {/* Top accent line */}
                        <div className="note-card-accent" style={{background:cls?.color||"#6366f1"}}/>

                        {/* Card body */}
                        <div className="note-card-body">
                          <div className="note-card-top">
                            <h3 className="note-card-title">{note.title}</h3>
                            <div className="note-card-actions" onClick={e=>e.stopPropagation()}>
                              <button
                                className="btn-icon note-action"
                                onClick={()=>openEdit(note)}
                                title="Edit"
                              >
                                <Edit2 size={13}/>
                              </button>
                              <button
                                className="btn-icon note-action note-del"
                                onClick={()=>setDeleteTarget(note)}
                                title="Delete"
                              >
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          </div>

                          {note.lecture_date && (
                            <div className="note-card-date">
                              <Clock size={11}/>
                              {formatDate(note.lecture_date)}
                            </div>
                          )}

                          {/* Content preview */}
                          <p className="note-card-preview">
                            {note.content
                              ? note.content.substring(0,120)+(note.content.length>120?"…":"")
                              : <span className="note-empty-preview">No content yet</span>
                            }
                          </p>

                          {/* Tags */}
                          {note.tags?.length > 0 && (
                            <div className="note-card-tags">
                              {note.tags.slice(0,4).map(t=>(
                                <span key={t} className="note-tag">
                                  <Hash size={9}/>{t}
                                </span>
                              ))}
                              {note.tags.length>4 && (
                                <span className="note-tag note-tag-more">
                                  +{note.tags.length-4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add note to class shortcut */}
                    <button
                      className="note-add-card"
                      onClick={e=>{e.stopPropagation();setForm(f=>({...blankForm,class_id:cls?.id||""}));setEditingNote(null);setTagInput("");setIsModalOpen(true);}}
                    >
                      <Plus size={20}/>
                      <span>New note for {cls?.course_code||"this class"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════ VIEW NOTE MODAL ══════════════ */}
      {viewingNote && (
        <div className="modal-overlay" onClick={()=>setViewingNote(null)}>
          <div className="modal modal-lg notes-view-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="notes-view-header-left">
                {(() => {
                  const cls = classes.find(c=>c.id===viewingNote.class_id);
                  return cls ? (
                    <span className="notes-view-course" style={{color:cls.color}}>
                      {cls.course_code}
                    </span>
                  ) : null;
                })()}
                <h2 className="notes-view-title">{viewingNote.title}</h2>
              </div>
              <div className="notes-view-actions">
                <button
                  className="btn btn-secondary"
                  onClick={()=>exportNote(viewingNote)}
                  title="Export as text"
                >
                  <Download size={14}/> Export
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={()=>{setViewingNote(null);openEdit(viewingNote);}}
                >
                  <Edit2 size={14}/> Edit
                </button>
                <button className="btn-icon" onClick={()=>setViewingNote(null)}>
                  <X size={16}/>
                </button>
              </div>
            </div>

            <div className="notes-view-body">
              {viewingNote.lecture_date && (
                <div className="notes-view-date">
                  <Clock size={13}/>
                  {formatDate(viewingNote.lecture_date)}
                </div>
              )}

              {viewingNote.tags?.length>0 && (
                <div className="notes-view-tags">
                  {viewingNote.tags.map(t=>(
                    <span key={t} className="note-tag note-tag-lg">
                      <Hash size={11}/>{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="notes-view-divider"/>

              <div className="notes-view-content">
                {viewingNote.content
                  ? viewingNote.content.split("\n").map((line,i)=>(
                      line.trim()
                        ? <p key={i}>{line}</p>
                        : <div key={i} className="notes-line-break"/>
                    ))
                  : <p className="notes-no-content">No content yet.</p>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ADD / EDIT MODAL ══════════════ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNote ? "Edit Note" : "New Note"}</h2>
              <button className="btn-icon" onClick={closeModal}><X size={16}/></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body notes-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Class</label>
                    <select
                      className="form-control"
                      value={form.class_id}
                      onChange={e=>setForm(f=>({...f,class_id:e.target.value}))}
                    >
                      <option value="">— General / No class —</option>
                      {classes.map(c=>(
                        <option key={c.id} value={c.id}>
                          {c.course_code} · {c.course_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Lecture Date</label>
                    <input
                      type="date" className="form-control"
                      value={form.lecture_date}
                      onChange={e=>setForm(f=>({...f,lecture_date:e.target.value}))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Title *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Lecture 5 — Recursion"
                    value={form.title}
                    onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                    required autoFocus
                  />
                </div>

                <div className="form-group notes-content-group">
                  <label>Content</label>
                  <textarea
                    className="form-control notes-textarea"
                    rows={14}
                    placeholder={"Write your notes here…\n\nTips:\n• Use blank lines between sections\n• Paste code snippets, formulas, key terms\n• Add definitions, examples, or summaries"}
                    value={form.content}
                    onChange={e=>setForm(f=>({...f,content:e.target.value}))}
                  />
                  <div className="notes-char-count">
                    {form.content.length} chars · {form.content.split(/\s+/).filter(Boolean).length} words
                  </div>
                </div>

                {/* Tags */}
                <div className="form-group">
                  <label>Tags</label>
                  <div className="notes-tag-input-row">
                    <div className="notes-tag-input-wrap">
                      <Hash size={13} className="notes-tag-input-icon"/>
                      <input
                        className="notes-tag-input"
                        placeholder="Add tag and press Enter"
                        value={tagInput}
                        onChange={e=>setTagInput(e.target.value)}
                        onKeyDown={e=>{
                          if(e.key==="Enter"){e.preventDefault();addTag();}
                          if(e.key===","){ e.preventDefault();addTag();}
                        }}
                      />
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={addTag}>
                      Add
                    </button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="notes-tags-display">
                      {form.tags.map(t=>(
                        <span key={t} className="note-tag note-tag-removable">
                          <Hash size={9}/>{t}
                          <button type="button" onClick={()=>removeTag(t)}>
                            <X size={9}/>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editingNote ? "Update Note" : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ DELETE CONFIRM ══════════════ */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-body" style={{textAlign:"center",padding:"2rem 1.5rem"}}>
              <div className="delete-modal-icon">🗑️</div>
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>Delete Note?</h3>
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
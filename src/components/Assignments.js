import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, writeBatch
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Trash2, Edit2, CheckCircle, Circle,
  AlertCircle, Clock, ChevronDown, ChevronUp,
  Folder, FolderOpen
} from "lucide-react";
import "../styles/Assignments.css";

const CATEGORIES = ["Homework","Quiz","Test","Project","Lab","Essay","Exam","Midterm","Final","Other"];

export default function Assignments() {
  const [user, setUser]               = useState(null);
  const [classes, setClasses]         = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter]           = useState("pending");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingA, setEditingA]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [expandedClasses, setExpandedClasses] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});

  const blankForm = {
    class_id:"", title:"", description:"", category:"Homework",
    due_date:"", total_points:100, is_completed:false,
    is_graded:false, is_recurring:false, recurrence_end_date:""
  };
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const u1 = onSnapshot(
      query(collection(db,"classes"), where("uid","==",uid), where("is_active","==",true)),
      s => setClasses(s.docs.map(d => ({ id:d.id,...d.data() })))
    );
    const u2 = onSnapshot(
      query(collection(db,"assignments"), where("uid","==",uid)),
      s => setAssignments(s.docs.map(d => ({ id:d.id,...d.data() })))
    );
    return () => { u1(); u2(); };
  }, [user]);

  const now = new Date();
  const todayStr = now.toDateString();
  const isOverdue  = ds => ds && new Date(ds) < now && new Date(ds).toDateString() !== todayStr;
  const isToday    = ds => ds && new Date(ds).toDateString() === todayStr;
  const isTomorrow = ds => {
    if (!ds) return false;
    const t = new Date(); t.setDate(t.getDate()+1);
    return new Date(ds).toDateString() === t.toDateString();
  };
  const isThisWeek = ds => {
    if (!ds) return false;
    const diff = (new Date(ds) - now) / 86400000;
    return diff >= 0 && diff <= 7;
  };
  const formatDue = ds => {
    if (!ds) return "";
    if (isOverdue(ds)) return "Overdue";
    if (isToday(ds))   return new Date(ds).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    if (isTomorrow(ds)) return "Tomorrow";
    const d = Math.ceil((new Date(ds)-now)/86400000);
    if (d <= 7) return d+"d";
    return new Date(ds).toLocaleDateString("en-US",{month:"short",day:"numeric"});
  };
  const dueTagClass = (ds, done) => {
    if (done) return "tag-done";
    if (isOverdue(ds))  return "tag-overdue";
    if (isToday(ds))    return "tag-today";
    if (isTomorrow(ds)) return "tag-tomorrow";
    return "tag-default";
  };

  const filtered = useMemo(() => {
    let list = assignments;
    if (filter === "pending")   list = list.filter(a => !a.is_completed);
    if (filter === "today")     list = list.filter(a => !a.is_completed && isToday(a.due_date));
    if (filter === "week")      list = list.filter(a => !a.is_completed && isThisWeek(a.due_date));
    if (filter === "completed") list = list.filter(a => a.is_completed);
    return [...list].sort((a,b) => {
      if (!a.is_completed && !b.is_completed) {
        if (isOverdue(a.due_date) && !isOverdue(b.due_date)) return -1;
        if (!isOverdue(a.due_date) && isOverdue(b.due_date)) return 1;
      }
      return new Date(a.due_date||"9999") - new Date(b.due_date||"9999");
    });
  }, [assignments, filter]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      const cls  = classes.find(c => c.id === a.class_id);
      const cKey = cls?.id || "unassigned";
      if (!map[cKey]) map[cKey] = { cls, categories: {} };
      const cat = a.category || "Other";
      if (!map[cKey].categories[cat]) map[cKey].categories[cat] = [];
      map[cKey].categories[cat].push(a);
    });
    Object.values(map).forEach(({ categories }) => {
      Object.keys(categories).forEach(cat => {
        categories[cat].sort((a,b) => {
          if (isOverdue(a.due_date) && !isOverdue(b.due_date)) return -1;
          if (!isOverdue(a.due_date) && isOverdue(b.due_date)) return 1;
          return new Date(a.due_date||"9999") - new Date(b.due_date||"9999");
        });
      });
    });
    return map;
  }, [filtered, classes]);

  const counts = useMemo(() => ({
    pending:   assignments.filter(a => !a.is_completed).length,
    today:     assignments.filter(a => !a.is_completed && isToday(a.due_date)).length,
    week:      assignments.filter(a => !a.is_completed && isThisWeek(a.due_date)).length,
    completed: assignments.filter(a => a.is_completed).length,
    overdue:   assignments.filter(a => !a.is_completed && isOverdue(a.due_date)).length,
  }), [assignments]);

  useEffect(() => {
    const newCls = {}, newFol = {};
    Object.entries(grouped).forEach(([cKey,{categories}]) => {
      if (expandedClasses[cKey] === undefined) newCls[cKey] = true;
      Object.keys(categories).forEach(cat => {
        const fKey = cKey+"__"+cat;
        if (expandedFolders[fKey] === undefined) newFol[fKey] = true;
      });
    });
    if (Object.keys(newCls).length) setExpandedClasses(p=>({...p,...newCls}));
    if (Object.keys(newFol).length) setExpandedFolders(p=>({...p,...newFol}));
  }, [grouped]);

  const openAdd  = () => { setForm(blankForm); setEditingA(null); setIsModalOpen(true); };
  const openEdit = a  => { setEditingA(a); setForm({...blankForm,...a}); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditingA(null); };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingA) {
        await updateDoc(doc(db,"assignments",editingA.id), form);
      } else if (form.is_recurring && form.recurrence_end_date) {
        const start = new Date(form.due_date), end = new Date(form.recurrence_end_date);
        const batch = []; let cur = new Date(start), n = 1;
        while (cur <= end) {
          const off = cur.getTimezoneOffset()*60000;
          batch.push(addDoc(collection(db,"assignments"),{
            ...form,
            title: form.title+" "+n,
            due_date: new Date(cur.getTime()-off).toISOString().slice(0,16),
            is_recurring:false, uid:user.uid
          }));
          cur.setDate(cur.getDate()+7); n++;
        }
        await Promise.all(batch);
      } else {
        await addDoc(collection(db,"assignments"),{...form,uid:user.uid});
      }
      closeModal();
    } catch(err){ console.error(err); }
    setSaving(false);
  };

  const toggleComplete = async a =>
    await updateDoc(doc(db,"assignments",a.id),{is_completed:!a.is_completed});

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db,"assignments",deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleBulkDelete = async () => {
    const b = writeBatch(db);
    selectedIds.forEach(id => b.delete(doc(db,"assignments",id)));
    await b.commit();
    setSelectedIds([]); setShowBulkDelete(false);
  };

  const toggleSelect = id =>
    setSelectedIds(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  const toggleClass  = key => setExpandedClasses(p=>({...p,[key]:!p[key]}));
  const toggleFolder = key => setExpandedFolders(p=>({...p,[key]:!p[key]}));

  if (!user) return <div className="asgn-signin">Please sign in to view assignments</div>;

  return (
    <div className="assignments-page">
      <div className="asgn-header">
        <div>
          <h1>Assignments</h1>
          <p>Track and manage your coursework</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16}/> Add Assignment
        </button>
      </div>

      {counts.overdue > 0 && filter !== "completed" && (
        <div className="asgn-overdue-banner" onClick={()=>setFilter("pending")}>
          <AlertCircle size={16}/>
          <span><strong>{counts.overdue}</strong> overdue — click to review</span>
        </div>
      )}

      <div className="asgn-filters">
        {[
          {key:"pending",   label:"Pending",   count:counts.pending},
          {key:"today",     label:"Due Today",  count:counts.today},
          {key:"week",      label:"This Week",  count:counts.week},
          {key:"completed", label:"Completed",  count:counts.completed},
          {key:"all",       label:"All",        count:assignments.length},
        ].map(f=>(
          <button key={f.key}
            className={"asgn-filter-btn"+(filter===f.key?" active":"")}
            onClick={()=>setFilter(f.key)}>
            {f.label}
            <span className={"asgn-filter-count"+(filter===f.key?" active":"")}>{f.count}</span>
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{filter==="completed"?"🎉":"✅"}</div>
          <h3>{filter==="completed"?"No completed assignments yet":"All caught up!"}</h3>
        </div>
      ) : (
        <div className="asgn-groups">
          {Object.entries(grouped).map(([cKey,{cls,categories}])=>{
            const clsOpen    = expandedClasses[cKey] !== false;
            const allItems   = Object.values(categories).flat();
            const hasOverdue = allItems.some(a=>!a.is_completed&&isOverdue(a.due_date));
            return (
              <div key={cKey} className={"asgn-class-block"+(hasOverdue?" has-overdue":"")}>
                <button
                  className="asgn-class-header"
                  style={{borderLeftColor:cls?.color||"#6366f1"}}
                  onClick={()=>toggleClass(cKey)}
                >
                  <div className="asgn-class-identity">
                    <span className="asgn-class-code" style={{color:cls?.color||"#818cf8"}}>
                      {cls?.course_code||"Unassigned"}
                    </span>
                    {cls && <span className="asgn-class-name">{cls.course_name}</span>}
                  </div>
                  <div className="asgn-class-right">
                    {hasOverdue && <span className="asgn-overdue-tag"><AlertCircle size={11}/> Overdue</span>}
                    <span className="asgn-class-count">{allItems.length}</span>
                    {clsOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </div>
                </button>

                {clsOpen && (
                  <div className="asgn-folders">
                    {Object.entries(categories).sort(([a],[b])=>a.localeCompare(b)).map(([cat,items])=>{
                      const fKey    = cKey+"__"+cat;
                      const folOpen = expandedFolders[fKey] !== false;
                      const folOverdue = items.some(a=>!a.is_completed&&isOverdue(a.due_date));
                      const nextDue   = items.filter(a=>!a.is_completed)[0];
                      return (
                        <div key={fKey} className="asgn-folder">
                          <button
                            className={"asgn-folder-header"+(folOverdue?" folder-overdue":"")}
                            onClick={()=>toggleFolder(fKey)}
                          >
                            <span className="asgn-folder-icon">
                              {folOpen
                                ? <FolderOpen size={15} style={{color:cls?.color||"#818cf8"}}/>
                                : <Folder     size={15} style={{color:cls?.color||"#818cf8"}}/>}
                            </span>
                            <span className="asgn-folder-name">{cat}</span>
                            <span className="asgn-folder-count">{items.length}</span>
                            {!folOpen && nextDue && (
                              <span className={"asgn-folder-next "+dueTagClass(nextDue.due_date,nextDue.is_completed)}>
                                <Clock size={10}/>{formatDue(nextDue.due_date)}
                              </span>
                            )}
                            {folOverdue && <span className="asgn-folder-overdue-dot"/>}
                            {folOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                          </button>

                          {folOpen && (
                            <div className="asgn-rows">
                              {items.map(a=>{
                                const overdue  = !a.is_completed && isOverdue(a.due_date);
                                const dueToday = !a.is_completed && isToday(a.due_date);
                                const selected = selectedIds.includes(a.id);
                                return (
                                  <div key={a.id} className={
                                    "asgn-row"+
                                    (a.is_completed?" row-done":"")+
                                    (overdue?" row-overdue":"")+
                                    (dueToday?" row-today":"")+
                                    (selected?" row-selected":"")
                                  }>
                                    <input type="checkbox" className="asgn-select-check"
                                      checked={selected} onChange={()=>toggleSelect(a.id)}
                                      onClick={e=>e.stopPropagation()}/>
                                    <button className="asgn-complete-btn" onClick={()=>toggleComplete(a)}>
                                      {a.is_completed
                                        ? <CheckCircle size={18} className="complete-icon done"/>
                                        : <Circle      size={18} className="complete-icon pending"/>}
                                    </button>
                                    <div className="asgn-row-info">
                                      <span className={"asgn-row-title"+(a.is_completed?" line-through":"")}>
                                        {a.title}
                                      </span>
                                      <div className="asgn-row-meta">
                                        <span className="asgn-pts">{a.total_points} pts</span>
                                        {a.description && (
                                          <span className="asgn-desc-snip">
                                            {a.description.substring(0,55)}{a.description.length>55?"…":""}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="asgn-row-right">
                                      {a.due_date && (
                                        <div className={"asgn-due-tag "+dueTagClass(a.due_date,a.is_completed)}>
                                          <Clock size={11}/>{formatDue(a.due_date)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="asgn-row-actions">
                                      <button className="btn-icon asgn-action" onClick={()=>openEdit(a)}>
                                        <Edit2 size={13}/>
                                      </button>
                                      <button className="btn-icon asgn-action asgn-del" onClick={()=>setDeleteTarget(a)}>
                                        <Trash2 size={13}/>
                                      </button>
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
              </div>
            );
          })}
        </div>
      )}

      <div className={"asgn-bulk-bar"+(selectedIds.length>0?" visible":"")}>
        <span className="bulk-count">{selectedIds.length} selected</span>
        <div className="bulk-actions">
          <button className="btn btn-secondary" onClick={()=>setSelectedIds([])}>Deselect</button>
          <button className="btn btn-danger" onClick={()=>setShowBulkDelete(true)}>
            <Trash2 size={14}/> Delete
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingA?"Edit Assignment":"Add Assignment"}</h2>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body asgn-form">
                <div className="form-group">
                  <label>Class *</label>
                  <select className="form-control" value={form.class_id}
                    onChange={e=>setForm(f=>({...f,class_id:e.target.value}))} required>
                    <option value="">— Select class —</option>
                    {classes.map(c=>(
                      <option key={c.id} value={c.id}>{c.course_code} · {c.course_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title *</label>
                  <input className="form-control" placeholder="Assignment title"
                    value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" rows={3} placeholder="Details, notes…"
                    value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-control" value={form.category}
                      onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                      {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Total Points</label>
                    <input type="number" min="0" className="form-control"
                      value={form.total_points}
                      onChange={e=>setForm(f=>({...f,total_points:Number(e.target.value)}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Due Date & Time *</label>
                  <input type="datetime-local" className="form-control" value={form.due_date}
                    onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} required/>
                </div>
                <label className="asgn-checkbox-label">
                  <input type="checkbox" checked={form.is_recurring}
                    onChange={e=>setForm(f=>({...f,is_recurring:e.target.checked}))}/>
                  Repeat weekly
                </label>
                {form.is_recurring && (
                  <div className="form-group asgn-recur-field">
                    <label>Repeat Until *</label>
                    <input type="date" className="form-control" value={form.recurrence_end_date}
                      onChange={e=>setForm(f=>({...f,recurrence_end_date:e.target.value}))}
                      required={form.is_recurring}/>
                    <span className="asgn-recur-hint">Creates one assignment per week until this date</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?"Saving…":editingA?"Update":"Add Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-body" style={{textAlign:"center",padding:"2rem 1.5rem"}}>
              <div className="delete-modal-icon">🗑️</div>
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>Delete Assignment?</h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>
                <strong style={{color:"var(--text-secondary)"}}>{deleteTarget.title}</strong><br/>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer" style={{justifyContent:"center"}}>
              <button className="btn btn-secondary" onClick={()=>setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showBulkDelete && (
        <div className="modal-overlay" onClick={()=>setShowBulkDelete(false)}>
          <div className="modal delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-body" style={{textAlign:"center",padding:"2rem 1.5rem"}}>
              <div className="delete-modal-icon">⚠️</div>
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>
                Delete {selectedIds.length} Assignment{selectedIds.length>1?"s":""}?
              </h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>This cannot be undone.</p>
            </div>
            <div className="modal-footer" style={{justifyContent:"center"}}>
              <button className="btn btn-secondary" onClick={()=>setShowBulkDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleBulkDelete}>Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
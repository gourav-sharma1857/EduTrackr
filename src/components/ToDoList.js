import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Trash2, Edit2, CheckCircle, Circle,
  X, Clock, Flag, Tag, ChevronDown, ChevronUp,
  CheckSquare, LayoutList, Sparkles
} from "lucide-react";
import "../styles/ToDoList.css";

const PRIORITIES = ["High","Medium","Low"];
const CATEGORIES = ["Personal","Academic","Work","Health","Finance","Other"];

const PRIORITY_META = {
  High:   { color:"#ef4444", bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.25)"   },
  Medium: { color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.25)"  },
  Low:    { color:"#10b981", bg:"rgba(16,185,129,0.12)",  border:"rgba(16,185,129,0.25)"  },
};

const CATEGORY_COLORS = {
  Personal: "#8b5cf6", Academic: "#3b82f6", Work: "#10b981",
  Health: "#f97316", Finance: "#f59e0b", Other: "#64748b",
};

export default function ToDoList() {
  const [user, setUser]             = useState(null);
  const [todos, setTodos]           = useState([]);
  const [filter, setFilter]         = useState("active");  // active | completed | all
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [completedMsg, setCompletedMsg] = useState("");
  const [saving, setSaving]         = useState(false);

  const blankForm = {
    title:"", description:"", due_date:"",
    priority:"Medium", category:"Personal", is_completed:false,
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
    const q = query(collection(db,"todos"), where("uid","==",user.uid));
    const unsub = onSnapshot(q, s =>
      setTodos(s.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)))
    );
    return () => unsub();
  }, [user]);

  /* ── Filtered + sorted ── */
  const filtered = useMemo(() => {
    return todos.filter(t => {
      const matchFilter   = filter==="all" || (filter==="active"?!t.is_completed:t.is_completed);
      const matchPriority = filterPriority==="all" || t.priority===filterPriority;
      const matchCategory = filterCategory==="all" || t.category===filterCategory;
      return matchFilter && matchPriority && matchCategory;
    }).sort((a,b) => {
      // Priority sort: High > Medium > Low > none, then by due date
      const pOrder = {High:0, Medium:1, Low:2};
      const pa = pOrder[a.priority]??3, pb = pOrder[b.priority]??3;
      if (pa!==pb) return pa-pb;
      return new Date(a.due_date||"9999") - new Date(b.due_date||"9999");
    });
  }, [todos, filter, filterPriority, filterCategory]);

  /* ── Grouped by category ── */
  const grouped = useMemo(() => {
    if (filter==="all" || filtered.length===0) return null;
    const map = {};
    filtered.forEach(t => {
      const c = t.category||"Other";
      if (!map[c]) map[c]=[];
      map[c].push(t);
    });
    return map;
  }, [filtered, filter]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    active:    todos.filter(t=>!t.is_completed).length,
    completed: todos.filter(t=>t.is_completed).length,
    high:      todos.filter(t=>!t.is_completed&&t.priority==="High").length,
    due:       todos.filter(t=>!t.is_completed&&t.due_date&&new Date(t.due_date).toDateString()===new Date().toDateString()).length,
  }), [todos]);

  /* ── CRUD ── */
  const openAdd = (cat="") => {
    setForm({...blankForm, category:cat||"Personal"});
    setEditingTodo(null);
    setIsModalOpen(true);
  };

  const openEdit = t => {
    setEditingTodo(t);
    setForm({
      title:t.title||"", description:t.description||"",
      due_date:t.due_date||"", priority:t.priority||"Medium",
      category:t.category||"Personal", is_completed:t.is_completed||false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingTodo(null); };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingTodo) {
        await updateDoc(doc(db,"todos",editingTodo.id),{
          ...form, updated_at:new Date().toISOString()
        });
      } else {
        await addDoc(collection(db,"todos"),{
          ...form, uid:user.uid,
          created_at:new Date().toISOString(),
          updated_at:new Date().toISOString(),
        });
      }
      closeModal();
    } catch(err){ console.error(err); }
    setSaving(false);
  };

  const toggleComplete = async t => {
    const next = !t.is_completed;
    await updateDoc(doc(db,"todos",t.id),{
      is_completed:next, updated_at:new Date().toISOString()
    });
    if (next) {
      setCompletedMsg(t.title);
      setTimeout(()=>setCompletedMsg(""), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db,"todos",deleteTarget.id));
    setDeleteTarget(null);
  };

  const formatDue = ds => {
    if (!ds) return null;
    const d    = new Date(ds);
    const now  = new Date();
    const diff = Math.ceil((d-now)/86400000);
    if (diff < 0)  return { label:"Overdue",  cls:"due-overdue" };
    if (diff === 0) return { label:"Today",   cls:"due-today" };
    if (diff === 1) return { label:"Tomorrow",cls:"due-tomorrow" };
    if (diff <= 7)  return { label:`${diff}d`, cls:"due-soon" };
    return { label:d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), cls:"" };
  };

  /* ── Todo card ── */
  const TodoItem = ({t, showCategory=false}) => {
    const p   = PRIORITY_META[t.priority] || PRIORITY_META.Medium;
    const due = formatDue(t.due_date);
    return (
      <div className={`todo-item ${t.is_completed?"todo-done":""} priority-${t.priority?.toLowerCase()}`}>
        {/* Priority left bar */}
        <div className="todo-priority-bar" style={{background:p.color}}/>

        {/* Complete button */}
        <button
          className="todo-check-btn"
          onClick={()=>toggleComplete(t)}
          title={t.is_completed?"Mark active":"Mark complete"}
        >
          {t.is_completed
            ? <CheckCircle size={20} className="todo-check-icon done"/>
            : <Circle      size={20} className="todo-check-icon pending"/>
          }
        </button>

        {/* Main content */}
        <div className="todo-content">
          <div className="todo-title-row">
            <span className={`todo-title ${t.is_completed?"todo-strikethrough":""}`}>
              {t.title}
            </span>
            {showCategory && (
              <span className="todo-cat-badge"
                style={{
                  background:CATEGORY_COLORS[t.category]+"18",
                  color:CATEGORY_COLORS[t.category],
                  border:`1px solid ${CATEGORY_COLORS[t.category]}33`
                }}>
                {t.category}
              </span>
            )}
          </div>
          {t.description && (
            <p className="todo-desc">{t.description}</p>
          )}
          <div className="todo-meta-row">
            <span className="todo-priority-tag"
              style={{background:p.bg, color:p.color, border:`1px solid ${p.border}`}}>
              <Flag size={9}/> {t.priority}
            </span>
            {due && (
              <span className={`todo-due ${due.cls}`}>
                <Clock size={10}/> {due.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="todo-actions">
          <button className="btn-icon todo-action" onClick={()=>openEdit(t)} title="Edit">
            <Edit2 size={13}/>
          </button>
          <button className="btn-icon todo-action todo-del"
            onClick={()=>setDeleteTarget(t)} title="Delete">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>
    );
  };

  if (!user) return <div className="todo-signin">Please sign in to view To-Do List</div>;

  return (
    <div className="todo-page">
      {/* ── Header ── */}
      <div className="todo-header">
        <div>
          <h1>To-Do List</h1>
          <p>Stay on top of everything that matters</p>
        </div>
        <button className="btn btn-primary" onClick={()=>openAdd()}>
          <Plus size={16}/> New Task
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="todo-stats stagger-1">
        <div className="todo-stat" onClick={()=>setFilter("active")}>
          <span className="todo-stat-val">{stats.active}</span>
          <span className="todo-stat-label">Active</span>
        </div>
        <div className="todo-stat-div"/>
        <div className="todo-stat" onClick={()=>setFilter("completed")}>
          <span className="todo-stat-val" style={{color:"#10b981"}}>{stats.completed}</span>
          <span className="todo-stat-label">Completed</span>
        </div>
        <div className="todo-stat-div"/>
        <div className="todo-stat">
          <span className="todo-stat-val" style={{color:"#ef4444"}}>{stats.high}</span>
          <span className="todo-stat-label">High Priority</span>
        </div>
        <div className="todo-stat-div"/>
        <div className="todo-stat">
          <span className="todo-stat-val" style={{color:"#f59e0b"}}>{stats.due}</span>
          <span className="todo-stat-label">Due Today</span>
        </div>
      </div>

      {/* ── Filter row ── */}
      <div className="todo-filters stagger-2">
        <div className="todo-filter-tabs">
          {["active","completed","all"].map(f=>(
            <button key={f}
              className={"todo-filter-tab"+(filter===f?" active":"")}
              onClick={()=>setFilter(f)}>
              {f==="active"?"Active":f==="completed"?"Completed":"All"}
              <span className="todo-filter-count">
                {f==="active"?stats.active:f==="completed"?stats.completed:todos.length}
              </span>
            </button>
          ))}
        </div>

        <div className="todo-filter-selects">
          <select className="todo-filter-select" value={filterPriority}
            onChange={e=>setFilterPriority(e.target.value)}>
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </select>
          <select className="todo-filter-select" value={filterCategory}
            onChange={e=>setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            {filter==="completed" ? "🎉" : filter==="active" && todos.length>0 ? "✅" : "📋"}
          </div>
          <h3>
            {filter==="completed" && todos.filter(t=>t.is_completed).length===0
              ? "No completed tasks yet"
              : filter==="active" && todos.length>0
              ? "All tasks done!"
              : todos.length===0
              ? "No tasks yet"
              : "No tasks match your filters"}
          </h3>
          {todos.length===0 && (
            <button className="btn btn-primary" style={{marginTop:"1rem"}} onClick={()=>openAdd()}>
              <Plus size={15}/> Create First Task
            </button>
          )}
        </div>
      ) : (
        <div className="todo-content stagger-3">
          {/* Grouped by category view (active/completed) */}
          {grouped ? (
            <div className="todo-grouped">
              {CATEGORIES.filter(c=>grouped[c]).map(cat=>(
                <div key={cat} className="todo-cat-group">
                  <div className="todo-cat-header">
                    <span className="todo-cat-dot"
                      style={{background:CATEGORY_COLORS[cat]}}/>
                    <span className="todo-cat-name"
                      style={{color:CATEGORY_COLORS[cat]}}>
                      {cat}
                    </span>
                    <span className="todo-cat-count">{grouped[cat].length}</span>
                    <button
                      className="todo-cat-add"
                      onClick={()=>openAdd(cat)}
                      title={`Add ${cat} task`}
                    >
                      <Plus size={12}/>
                    </button>
                  </div>
                  <div className="todo-list">
                    {grouped[cat].map(t=>(
                      <TodoItem key={t.id} t={t} showCategory={false}/>
                    ))}
                  </div>
                </div>
              ))}
              {/* "Other" catch-all */}
              {grouped["Other"] && (
                <div key="Other" className="todo-cat-group">
                  <div className="todo-cat-header">
                    <span className="todo-cat-dot" style={{background:"#64748b"}}/>
                    <span className="todo-cat-name" style={{color:"#64748b"}}>Other</span>
                    <span className="todo-cat-count">{grouped["Other"].length}</span>
                  </div>
                  <div className="todo-list">
                    {grouped["Other"].map(t=>(
                      <TodoItem key={t.id} t={t}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Flat list for "all" view */
            <div className="todo-list">
              {filtered.map(t=>(
                <TodoItem key={t.id} t={t} showCategory={true}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Completion toast ── */}
      {completedMsg && (
        <div className="todo-toast">
          <CheckCircle size={16} style={{color:"#10b981"}}/>
          <span><strong>{completedMsg}</strong> — nice work!</span>
          <Sparkles size={14} style={{color:"#f59e0b"}}/>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTodo?"Edit Task":"New Task"}</h2>
              <button className="btn-icon" onClick={closeModal}><X size={16}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body todo-form">
                <div className="form-group">
                  <label>Title *</label>
                  <input className="form-control" placeholder="What needs to be done?"
                    value={form.title}
                    onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                    required autoFocus/>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" rows={3}
                    placeholder="Add more details…"
                    value={form.description}
                    onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Priority</label>
                    <select className="form-control" value={form.priority}
                      onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
                      style={{color:PRIORITY_META[form.priority]?.color}}>
                      {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-control" value={form.category}
                      onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                      {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="datetime-local" className="form-control"
                    value={form.due_date}
                    onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?"Saving…":editingTodo?"Update Task":"Add Task"}
                </button>
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
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>Delete Task?</h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>
                <strong style={{color:"var(--text-secondary)"}}>{deleteTarget.title}</strong>
                <br/>This cannot be undone.
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
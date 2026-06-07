import React, { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  Plus, Trash2, Edit2, ExternalLink, Briefcase,
  TrendingUp, Award, Clock, ChevronDown, ChevronUp,
  Search, Filter, X, Building2, MapPin, Calendar
} from "lucide-react";
import Confetti from "react-confetti";
import "../styles/Career.css";

const TYPE_OPTIONS   = ["Internship","Full-time","Part-time","Hackathon","Club","Research","Other"];
const STATUS_OPTIONS = ["Applied","Interview","Offer","Accepted","Rejected","Declined","Withdrawn"];

const STATUS_META = {
  Applied:   { bg:"rgba(100,116,139,0.15)", text:"#94a3b8", border:"rgba(100,116,139,0.25)", icon:"📤" },
  Interview: { bg:"rgba(59,130,246,0.15)",  text:"#60a5fa", border:"rgba(59,130,246,0.25)",  icon:"🎙" },
  Offer:     { bg:"rgba(16,185,129,0.15)",  text:"#34d399", border:"rgba(16,185,129,0.25)",  icon:"🎉" },
  Accepted:  { bg:"rgba(34,197,94,0.15)",   text:"#4ade80", border:"rgba(34,197,94,0.25)",   icon:"✅" },
  Rejected:  { bg:"rgba(239,68,68,0.15)",   text:"#f87171", border:"rgba(239,68,68,0.25)",   icon:"❌" },
  Declined:  { bg:"rgba(249,115,22,0.15)",  text:"#fb923c", border:"rgba(249,115,22,0.25)",  icon:"🚫" },
  Withdrawn: { bg:"rgba(107,114,128,0.15)", text:"#9ca3af", border:"rgba(107,114,128,0.25)", icon:"↩" },
};

export default function Career() {
  const [user, setUser]           = useState(null);
  const [applications, setApplications] = useState([]);
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingApp,  setEditingApp]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState({});
  const [saving, setSaving]       = useState(false);
  const [viewMode, setViewMode]   = useState("grouped"); // grouped | list

  const blankForm = {
    type:"Internship", company_organization:"", position:"",
    status:"Applied", applied_date:"", deadline:"",
    interview_date:"", interview_time:"", notes:"", url:""
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
    const q = query(collection(db,"applications"), where("uid","==",user.uid));
    const unsub = onSnapshot(q, s =>
      setApplications(s.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>new Date(b.applied_date||0)-new Date(a.applied_date||0)))
    );
    return () => unsub();
  }, [user]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return applications.filter(a => {
      const matchSearch = !q ||
        a.company_organization?.toLowerCase().includes(q) ||
        a.position?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q);
      const matchStatus = filterStatus==="all" || a.status===filterStatus;
      const matchType   = filterType==="all"   || a.type===filterType;
      return matchSearch && matchStatus && matchType;
    });
  }, [applications, search, filterStatus, filterType]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:      applications.length,
    interviews: applications.filter(a=>a.status==="Interview").length,
    offers:     applications.filter(a=>a.status==="Offer"||a.status==="Accepted").length,
    pending:    applications.filter(a=>a.status==="Applied").length,
    rejected:   applications.filter(a=>a.status==="Rejected").length,
  }), [applications]);

  /* ── Grouped by type ── */
  const grouped = useMemo(() =>
    filtered.reduce((acc,app)=>{
      if (!acc[app.type]) acc[app.type] = [];
      acc[app.type].push(app);
      return acc;
    },{})
  , [filtered]);

  /* Auto-expand all groups */
  useEffect(() => {
    const next = {};
    Object.keys(grouped).forEach(k => {
      if (expandedTypes[k]===undefined) next[k]=true;
    });
    if (Object.keys(next).length)
      setExpandedTypes(p=>({...p,...next}));
  }, [grouped]);

  /* ── CRUD ── */
  const openAdd = () => { setForm(blankForm); setEditingApp(null); setIsModalOpen(true); };
  const openEdit = app => { setEditingApp(app); setForm({...blankForm,...app}); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditingApp(null); };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingApp) {
        await updateDoc(doc(db,"applications",editingApp.id), form);
      } else {
        await addDoc(collection(db,"applications"),{...form,uid:user.uid});
      }
      if (form.status==="Offer"||form.status==="Accepted") triggerConfetti();
      closeModal();
    } catch(err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db,"applications",deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db,"applications",id),{status});
    if (status==="Offer"||status==="Accepted") triggerConfetti();
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(()=>setShowConfetti(false), 5000);
  };

  const formatDate = ds => {
    if (!ds) return "";
    return new Date(ds).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  };

  const toggleType = key => setExpandedTypes(p=>({...p,[key]:!p[key]}));

  const statusPill = (status, onChange) => {
    const m = STATUS_META[status] || STATUS_META.Applied;
    if (onChange) {
      return (
        <select
          className="career-status-select"
          value={status}
          onChange={e=>onChange(e.target.value)}
          style={{background:m.bg, color:m.text, borderColor:m.border}}
          onClick={e=>e.stopPropagation()}
        >
          {STATUS_OPTIONS.map(s=>(
            <option key={s} value={s}>{STATUS_META[s]?.icon} {s}</option>
          ))}
        </select>
      );
    }
    return (
      <span className="career-status-pill"
        style={{background:m.bg, color:m.text, border:`1px solid ${m.border}`}}>
        {m.icon} {status}
      </span>
    );
  };

  if (!user) return <div className="career-signin">Please sign in to view Career Tracker</div>;

  return (
    <div className="career-page">
      {showConfetti && <Confetti recycle={false} numberOfPieces={400} gravity={0.25}/>}

      {/* ── Header ── */}
      <div className="career-header">
        <div>
          <h1>Career Tracker</h1>
          <p>Track applications, interviews, and opportunities</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16}/> Add Application
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="career-stats stagger-1">
        {[
          { label:"Total",      val:stats.total,      color:"#3b82f6", icon:<Briefcase size={18}/> },
          { label:"Interviews", val:stats.interviews,  color:"#6366f1", icon:<TrendingUp size={18}/> },
          { label:"Offers",     val:stats.offers,      color:"#10b981", icon:<Award size={18}/> },
          { label:"Pending",    val:stats.pending,     color:"#f59e0b", icon:<Clock size={18}/> },
          { label:"Rejected",   val:stats.rejected,    color:"#ef4444", icon:<X size={18}/> },
        ].map(s=>(
          <div key={s.label} className="career-stat">
            <div className="career-stat-icon" style={{background:s.color+"18", color:s.color}}>
              {s.icon}
            </div>
            <div className="career-stat-body">
              <span className="career-stat-val" style={{color:s.color}}>{s.val}</span>
              <span className="career-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="career-toolbar stagger-2">
        <div className="career-search-wrap">
          <Search size={14} className="career-search-icon"/>
          <input
            className="career-search"
            placeholder="Search company, role, notes…"
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
          {search && (
            <button className="career-search-clear" onClick={()=>setSearch("")}>
              <X size={12}/>
            </button>
          )}
        </div>

        <select className="career-filter" value={filterStatus}
          onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>

        <select className="career-filter" value={filterType}
          onChange={e=>setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {TYPE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💼</div>
          <h3>{applications.length===0 ? "No applications yet" : "No results found"}</h3>
          <p>{applications.length===0 ? "Start tracking your career journey" : "Try adjusting your filters"}</p>
          {applications.length===0 && (
            <button className="btn btn-primary" style={{marginTop:"1rem"}} onClick={openAdd}>
              <Plus size={15}/> Add First Application
            </button>
          )}
        </div>
      ) : (
        <div className="career-groups stagger-3">
          {Object.entries(grouped).map(([type, apps])=>{
            const isOpen = expandedTypes[type] !== false;
            return (
              <div key={type} className="career-group">
                {/* Group header */}
                <button
                  className="career-group-header"
                  onClick={()=>toggleType(type)}
                >
                  <div className="career-group-identity">
                    <span className="career-group-icon">💼</span>
                    <span className="career-group-type">{type}</span>
                    <span className="career-group-count">{apps.length}</span>
                  </div>
                  <div className="career-group-right">
                    {/* Mini status breakdown */}
                    <div className="career-group-breakdown">
                      {Object.entries(
                        apps.reduce((acc,a)=>{acc[a.status]=(acc[a.status]||0)+1;return acc;},{})
                      ).map(([s,n])=>{
                        const m = STATUS_META[s];
                        return (
                          <span key={s} className="career-breakdown-pill"
                            style={{background:m?.bg, color:m?.text, border:`1px solid ${m?.border}`}}>
                            {n} {s}
                          </span>
                        );
                      })}
                    </div>
                    {isOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </div>
                </button>

                {/* Application cards */}
                {isOpen && (
                  <div className="career-cards">
                    {apps.map(app=>(
                      <div key={app.id} className="career-card">
                        {/* Card header */}
                        <div className="career-card-header">
                          <div className="career-card-identity">
                            <div className="career-company-avatar">
                              {app.company_organization?.[0]?.toUpperCase()||"?"}
                            </div>
                            <div className="career-card-info">
                              <h3 className="career-position">{app.position}</h3>
                              <div className="career-company-row">
                                <Building2 size={12}/>
                                <span className="career-company">{app.company_organization}</span>
                              </div>
                            </div>
                          </div>
                          <div className="career-card-actions">
                            {app.url && (
                              <a
                                href={app.url} target="_blank" rel="noopener noreferrer"
                                className="btn-icon career-action"
                                onClick={e=>e.stopPropagation()}
                                title="Open link"
                              >
                                <ExternalLink size={13}/>
                              </a>
                            )}
                            <button className="btn-icon career-action"
                              onClick={()=>openEdit(app)} title="Edit">
                              <Edit2 size={13}/>
                            </button>
                            <button className="btn-icon career-action career-del"
                              onClick={()=>setDeleteTarget(app)} title="Delete">
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        </div>

                        {/* Status dropdown */}
                        <div className="career-card-status">
                          {statusPill(app.status, (s)=>handleStatusChange(app.id,s))}
                        </div>

                        {/* Dates row */}
                        <div className="career-card-dates">
                          {app.applied_date && (
                            <div className="career-date-item">
                              <Calendar size={11}/> Applied {formatDate(app.applied_date)}
                            </div>
                          )}
                          {app.deadline && (
                            <div className="career-date-item deadline">
                              <Clock size={11}/> Due {formatDate(app.deadline)}
                            </div>
                          )}
                          {app.interview_date && (
                            <div className="career-date-item interview">
                              <span>🎙</span>
                              Interview {formatDate(app.interview_date)}
                              {app.interview_time && ` at ${app.interview_time}`}
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        {app.notes && (
                          <p className="career-card-notes">{app.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingApp?"Edit Application":"Add Application"}</h2>
              <button className="btn-icon" onClick={closeModal}><X size={16}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body career-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Type *</label>
                    <select className="form-control" value={form.type}
                      onChange={e=>setForm(f=>({...f,type:e.target.value}))} required>
                      {TYPE_OPTIONS.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status *</label>
                    <select className="form-control" value={form.status}
                      onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                      style={{color:STATUS_META[form.status]?.text}}>
                      {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Company / Organization *</label>
                  <input className="form-control" placeholder="e.g. Google, Startup Inc."
                    value={form.company_organization}
                    onChange={e=>setForm(f=>({...f,company_organization:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label>Position *</label>
                  <input className="form-control" placeholder="e.g. Software Engineering Intern"
                    value={form.position}
                    onChange={e=>setForm(f=>({...f,position:e.target.value}))} required/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Applied Date</label>
                    <input type="date" className="form-control" value={form.applied_date}
                      onChange={e=>setForm(f=>({...f,applied_date:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label>Deadline</label>
                    <input type="date" className="form-control" value={form.deadline}
                      onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Interview Date</label>
                    <input type="date" className="form-control" value={form.interview_date}
                      onChange={e=>setForm(f=>({...f,interview_date:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label>Interview Time</label>
                    <input type="time" className="form-control" value={form.interview_time}
                      onChange={e=>setForm(f=>({...f,interview_time:e.target.value}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Application URL</label>
                  <input type="url" className="form-control" placeholder="https://…"
                    value={form.url}
                    onChange={e=>setForm(f=>({...f,url:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea className="form-control" rows={3}
                    placeholder="Interview prep, referrals, key contacts…"
                    value={form.notes}
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving?"Saving…":editingApp?"Update":"Add Application"}
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
              <h3 style={{color:"var(--text-primary)",marginBottom:"0.5rem"}}>Delete Application?</h3>
              <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>
                <strong style={{color:"var(--text-secondary)"}}>
                  {deleteTarget.position} @ {deleteTarget.company_organization}
                </strong><br/>This cannot be undone.
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
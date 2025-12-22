import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use'; 
import "../styles/Career.css";

export default function Career() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const { width, height } = useWindowSize();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [formData, setFormData] = useState({
    type: "Internship",
    company_organization: "",
    position: "",
    status: "Applied",
    applied_date: "",
    deadline: "",
    interview_date: "",
    interview_time: "",
    notes: "",
    url: ""
  });

  const typeOptions = ["Internship", "Full-time", "Part-time", "Hackathon", "Club", "Research", "Other"];
  const statusOptions = ["Applied", "Interview", "Offer", "Rejected", "Accepted", "Declined", "Withdrawn"];

  const statusColors = {
    "Applied": { bg: "rgba(100, 116, 139, 0.2)", text: "#94a3b8" },
    "Interview": { bg: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" },
    "Offer": { bg: "rgba(16, 185, 129, 0.2)", text: "#34d399" },
    "Rejected": { bg: "rgba(239, 68, 68, 0.2)", text: "#f87171" },
    "Accepted": { bg: "rgba(34, 197, 94, 0.2)", text: "#4ade80" },
    "Declined": { bg: "rgba(249, 115, 22, 0.2)", text: "#fb923c" },
    "Withdrawn": { bg: "rgba(107, 114, 128, 0.2)", text: "#9ca3af" }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "applications"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setApplications(data.sort((a, b) => new Date(b.applied_date || 0) - new Date(a.applied_date || 0)));
    });
    return () => unsub();
  }, [user]);

  const resetForm = () => {
    setFormData({
      type: "Internship",
      company_organization: "",
      position: "",
      status: "Applied",
      applied_date: "",
      deadline: "",
      interview_date: "",
      interview_time: "",
      notes: "",
      url: ""
    });
    setEditingApp(null);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (editingApp) {
    await updateDoc(doc(db, "applications", editingApp.id), formData);
  } else {
    await addDoc(collection(db, "applications"), { ...formData, uid: user.uid });
  }
  
  if (formData.status === "Offer" || formData.status === "Accepted") {
    triggerConfetti();
  }

  setIsDialogOpen(false);
  resetForm();
};

  const handleEdit = (app) => {
    setEditingApp(app);
    setFormData({
      ...app,
      interview_date: app.interview_date || "",
      interview_time: app.interview_time || ""
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = (item) => {
  setItemToDelete(item);
  setIsDeleteDialogOpen(true);
};

const handleDeleteCareerItem = async () => {
  if (!itemToDelete?.id) return;
  try {
    await deleteDoc(doc(db, "applications", itemToDelete.id)); 
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  } catch (error) {
    console.error("Error deleting career item:", error);
  }
};

  const triggerConfetti = () => {
  setShowConfetti(true);
  setTimeout(() => setShowConfetti(false), 5000);
};

const handleStatusChange = async (appId, newStatus) => {
  await updateDoc(doc(db, "applications", appId), { status: newStatus });
  if (newStatus === "Offer" || newStatus === "Accepted") {
    triggerConfetti();
  }
};

  const groupedByType = applications.reduce((acc, app) => {
    if (!acc[app.type]) acc[app.type] = [];
    acc[app.type].push(app);
    return acc;
  }, {});

  const stats = {
    total: applications.length,
    interviews: applications.filter(a => a.status === "Interview").length,
    offers: applications.filter(a => a.status === "Offer" || a.status === "Accepted").length,
    pending: applications.filter(a => a.status === "Applied").length
  };

  if (!user) {
    return <div className="empty-state">Please sign in to view career tracker</div>;
  }

  return (
    <div className="career-container">
      {showConfetti && (
      <Confetti
        width={width}
        height={height}
        recycle={false} 
        numberOfPieces={500}
        gravity={0.2}
      />
    )}
      <div className="career-header">
        <div>
          <h1>Career Tracker</h1>
          <p>Track your internships, jobs, and opportunities</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          + Add Application
        </button>
      </div>

      {/* Stats */}
      <div className="career-stats">
        <div className="career-stat blue">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Applied</span>
        </div>
        <div className="career-stat purple">
          <span className="stat-number">{stats.interviews}</span>
          <span className="stat-label">Interviews</span>
        </div>
        <div className="career-stat green">
          <span className="stat-number">{stats.offers}</span>
          <span className="stat-label">Offers</span>
        </div>
        <div className="career-stat orange">
          <span className="stat-number">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>

      {/* Applications by Type */}
      {applications.length === 0 ? (
        <div className="empty-card">No applications yet. Start tracking your career journey!</div>
      ) : (
        <div className="applications-section">
          {Object.entries(groupedByType).map(([type, apps]) => (
            <div key={type} className="type-group">
              <div className="type-header">
                <h2>💼 {type}</h2>
                <span className="type-count">{apps.length}</span>
              </div>
              <div className="applications-list">
                {apps.map(app => (
                  <div key={app.id} className="application-card">
                    <div className="app-main">
                      <div className="app-info">
                        <h3>{app.position}</h3>
                        <p className="app-company">{app.company_organization}</p>
                      </div>
                      <div className="app-actions">
                        {app.url && (
                          <a href__={app.url} target="_blank" rel="noopener noreferrer" className="btn-link">🔗</a>
                        )}
                        <button className="btn-edit" onClick={() => handleEdit(app)}>✏️</button>
                        <button className="btn-delete-icon" onClick={() => confirmDelete(app)} title="Delete Entry">🗑️</button>
                      </div>
                    </div>
                    
                    <div className="app-details">
                      {/* Status Dropdown */}
                      <div className="status-dropdown">
                        <select 
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}
                          className="status-select"
                          style={{ 
                            backgroundColor: statusColors[app.status]?.bg,
                            color: statusColors[app.status]?.text
                          }}
                        >
                          {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      
                      {app.applied_date && (
                        <span className="app-date">Applied: {new Date(app.applied_date).toLocaleDateString()}</span>
                      )}
                      {app.deadline && (
                        <span className="app-date">Deadline: {new Date(app.deadline).toLocaleDateString()}</span>
                      )}
                      {app.interview_date && (
                        <span className="app-date interview">
                          📅 Interview: {new Date(app.interview_date).toLocaleDateString()}
                          {app.interview_time && ` at ${app.interview_time}`}
                        </span>
                      )}
                    </div>
                    
                    {app.notes && (
                      <div className="app-notes">
                        <p>{app.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingApp ? "Edit Application" : "Add Application"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Type *</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} required>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status *</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} required>
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Company/Organization *</label>
                <input
                  value={formData.company_organization}
                  onChange={(e) => setFormData({ ...formData, company_organization: e.target.value })}
                  placeholder="Company name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Position *</label>
                <input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Position title"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Applied Date</label>
                  <input
                    type="date"
                    value={formData.applied_date}
                    onChange={(e) => setFormData({ ...formData, applied_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Deadline</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
              </div>

              {/* Interview Date/Time */}
              <div className="form-row">
                <div className="form-group">
                  <label>Interview Date</label>
                  <input
                    type="date"
                    value={formData.interview_date}
                    onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Interview Time</label>
                  <input
                    type="time"
                    value={formData.interview_time}
                    onChange={(e) => setFormData({ ...formData, interview_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Application URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes, interview prep, etc."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary orange">{editingApp ? "Update" : "Add"} Application</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDeleteDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteDialogOpen(false)}>
          <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon">⚠</div>
            <h3>Delete Career Entry?</h3>
            <p>Are you sure you want to delete <strong>{itemToDelete?.title || itemToDelete?.company}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="dialog-actions">
              <button onClick={() => setIsDeleteDialogOpen(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDeleteCareerItem} className="confirm-delete-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
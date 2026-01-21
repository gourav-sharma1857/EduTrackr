import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { writeBatch } from "firebase/firestore"
import "../styles/Assignments.css";

export default function Assignments() {
  const [user, setUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [selectedIds, setSelectedIds] = useState([]);
  const [formData, setFormData] = useState({
    class_id: "",
    title: "",
    description: "",
    category: "Homework",
    due_date: "",
    total_points: 100,
    is_completed: false,
    is_graded: false,
    is_recurring: false,
    recurrence_end_date: ""
  });

  const toggleSelectAssignment = (id) => {
  setSelectedIds(prev => 
    prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
  );
};

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAssignments.length) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(filteredAssignments.map(a => a.id)); // Select all current
    }
  };

  const handleBulkDelete = async () => {
  if (selectedIds.length === 0) return;
  
  const batch = writeBatch(db);
  selectedIds.forEach((id) => {
    const docRef = doc(db, "assignments", id);
    batch.delete(docRef);
  });

  try {
    await batch.commit();
    setSelectedIds([]); 
    setShowDeleteDialog(false);
  } catch (err) {
    console.error("Bulk delete failed:", err);
  }
};

  const categoryOptions = ["Homework", "Quiz", "Test", "Project", "Lab", "Essay", "Other"];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "classes"), where("uid", "==", user.uid), where("is_active", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "assignments"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const resetForm = () => {
    setFormData({
      class_id: "",
      title: "",
      description: "",
      category: "Homework",
      due_date: "",
      total_points: 100,
      is_completed: false,
      is_graded: false,
      is_recurring: false,
      recurrence_end_date: ""
    });
    setEditingAssignment(null);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    if (editingAssignment) {
      await updateDoc(doc(db, "assignments", editingAssignment.id), formData);
    } else {
      if (formData.is_recurring && formData.recurrence_end_date) {
        const start = new Date(formData.due_date);
        const end = new Date(formData.recurrence_end_date);
        const batchPromises = [];

        let currentDue = new Date(start);
        let count = 1;

        while (currentDue <= end) {
          const numberedTitle = `${formData.title} ${count}`;

          batchPromises.push(addDoc(collection(db, "assignments"), {
            ...formData,
            title: numberedTitle, 
            due_date: new Date(currentDue.getTime() - (currentDue.getTimezoneOffset() * 60000)).toISOString().slice(0, 16),            uid: user.uid,
            is_recurring: false 
          }));

          currentDue.setDate(currentDue.getDate() + 7);
          count++;
        }
        await Promise.all(batchPromises);
      } else {
        await addDoc(collection(db, "assignments"), { ...formData, uid: user.uid });
      }
    }
    setIsDialogOpen(false);
    resetForm();
  } catch (err) {
    console.error("Error saving assignment:", err);
  }
};

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    setFormData(assignment);
    setIsDialogOpen(true);
  };

  const handleDeleteAssignment = async () => {
  try {
    const batch = writeBatch(db); 

    if (selectedIds.length > 0) {
      selectedIds.forEach((id) => {
        batch.delete(doc(db, "assignments", id));
      });
      await batch.commit();
    } else if (assignmentToDelete) {
      await deleteDoc(doc(db, "assignments", assignmentToDelete.id));
    }

    setShowDeleteDialog(false);
    setAssignmentToDelete(null);
    setSelectedIds([]); 
  } catch (err) {
    console.error("Error deleting:", err);
    alert("Failed to delete: " + err.message);
  }
};

  const handleToggleComplete = async (assignment) => {
    await updateDoc(doc(db, "assignments", assignment.id), { is_completed: !assignment.is_completed });
  };

  const isOverdue = (date) => new Date(date) < new Date() && !isToday(date);
  const isToday = (dateString) => {
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
};

const isTomorrow = (dateString) => {
  const d = new Date(dateString);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getDate() === tomorrow.getDate() &&
         d.getMonth() === tomorrow.getMonth() &&
         d.getFullYear() === tomorrow.getFullYear();
};

  const formatDate = (dateString) => {
  const date = new Date(dateString); 
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    hour: "numeric", 
    minute: "2-digit" 
  });
};

  const filteredAssignments = assignments.filter(a => {
    if (filter === "pending") return !a.is_completed;
    if (filter === "completed") return a.is_completed;
    return true;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const groupedByClass = {};
  filteredAssignments.forEach(assignment => {
    const cls = classes.find(c => c.id === assignment.class_id);
    const classKey = cls?.id || "unknown";
    if (!groupedByClass[classKey]) {
      groupedByClass[classKey] = { class: cls, assignments: [] };
    }
    groupedByClass[classKey].assignments.push(assignment);
  });

  if (!user) {
    return <div className="empty-state">Please sign in to view assignments</div>;
  }

  return (
    <div className="assignments-container">
      <div className="assignments-header">
        <div>
          <h1>Assignments</h1>
          <p>Track and manage your coursework</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          + Add Assignment
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button className={`filter-btn ${filter === "pending" ? "active" : ""}`} onClick={() => setFilter("pending")}>
          📋 Pending ({assignments.filter(a => !a.is_completed).length})
        </button>
        <button className={`filter-btn ${filter === "completed" ? "active" : ""}`} onClick={() => setFilter("completed")}>
          ✅ Completed ({assignments.filter(a => a.is_completed).length})
        </button>
        <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          📚 All ({assignments.length})
        </button>
      </div>

      {/* Assignments List */}
      {Object.keys(groupedByClass).length === 0 ? (
        <div className="empty-card">
          {filter === "pending" ? "No pending assignments! 🎉" : "No assignments found"}
        </div>
      ) : (
        <div className="assignments-list">
          {Object.values(groupedByClass).map(({ class: cls, assignments: classAssignments }) => (
            <div key={cls?.id || "unknown"} className="class-group">
              <div className="class-group-header" style={{ borderLeftColor: cls?.color || "#64748b" }}>
                <h3>{cls?.course_code || "Unknown Class"}</h3>
                <span className="class-name">{cls?.course_name}</span>
                <span className="assignment-count">{classAssignments.length} assignments</span>
              </div>
              <div className="class-assignments">
                {classAssignments.map(assignment => (
                  <div key={assignment.id} className={`assignment-card ${assignment.is_completed ? "completed" : ""}`}>
              
                    <div className="assignment-selection">
                      <input
                        type="checkbox"
                        title="Select"
                        checked={selectedIds.includes(assignment.id)}
                        onChange={() => toggleSelectAssignment(assignment.id)}
                      />
                    </div>
                    <div className="assignment-info">
                      <div className="assignment-header">
                        <h4 className={assignment.is_completed ? "strikethrough" : ""}>{assignment.title}</h4>
                        <span className="category-badge">{assignment.category}</span>
                      </div>
                      {assignment.description && <p className="assignment-desc">{assignment.description}</p>}
                      <div className="assignment-meta">
                        <span className="points">{assignment.total_points} pts</span>
                        <span className={`due-date ${isOverdue(assignment.due_date) && !assignment.is_completed ? "overdue" : isToday(assignment.due_date) ? "today" : ""}`}>
                          {isOverdue(assignment.due_date) && !assignment.is_completed ? "⚠️ Overdue" : 
                           isToday(assignment.due_date) ? "📌 Due Today" : 
                           isTomorrow(assignment.due_date) ? "📅 Tomorrow" : formatDate(assignment.due_date)}
                        </span>
                      </div>
                    </div>
                    <div className="assignment-actions">
                      <button title="Edit" className="btn-icon" onClick={() => handleEdit(assignment)}>✏️</button>
                      <button title="Delete" className="btn-icon" onClick={() => { setAssignmentToDelete(assignment); setShowDeleteDialog(true); }}>🗑️</button>
                    </div>
                    <div className="assignment-checkbox">
                      <input
                      title="Mark as done"
                        type="checkbox"
                        checked={assignment.is_completed}
                        onChange={() => handleToggleComplete(assignment)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showDeleteDialog && (
      <div className="modal-overlay" onClick={() => setShowDeleteDialog(false)}>
        <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="delete-icon">⚠</div>
          
          <h3>Delete Assignment?</h3>
          <p>
            Are you sure you want to delete <strong>{assignmentToDelete?.title}</strong>?
          </p>
          
          <p className="warning-text">This action cannot be undone.</p>
          
          <div className="dialog-actions">
            <button 
              onClick={() => setShowDeleteDialog(false)} 
              className="cancel-btn"
            >
              Cancel
            </button>
            
            <button 
              onClick={handleDeleteAssignment} 
              className="confirm-delete-btn"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}

      <div className={`bulk-floating-bar ${selectedIds.length > 0 ? 'active' : ''}`}>
        <div className="bar-content">
          <span className="count-badge">{selectedIds.length} Selected</span>
          <div className="bar-actions">
            <button className="btn-secondary-light" onClick={() => setSelectedIds([])}>
              Deselect
            </button>
            <button className="btn-danger-bright" onClick={() => setShowDeleteDialog(true)}>
              🗑️ Delete Permanently
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAssignment ? "Edit Assignment" : "Add New Assignment"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Class *</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.course_code} - {cls.course_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Assignment title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Assignment details..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Total Points</label>
                  <input
                    type="number"
                    value={formData.total_points}
                    onChange={(e) => setFormData({ ...formData, total_points: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  />
                  Repeat Weekly
                </label>
              </div>

            {formData.is_recurring && (
              <div className="form-group animate-fade-in">
                <label>Repeat Until *</label>
                <input
                  type="date"
                  value={formData.recurrence_end_date}
                  onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                  required={formData.is_recurring}
                />
                <p className="helper-text">This will create an assignment every week until this date.</p>
              </div>)}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingAssignment ? "Update" : "Add"} Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
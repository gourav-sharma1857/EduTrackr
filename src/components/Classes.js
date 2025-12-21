import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/Classes.css";

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", 
  "#EF4444", "#06B6D4", "#6366F1", 
  "#84CC16", "#A855F7", , 
  "#FACC15", "#FB7185", 
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Classes() {
  const [user, setUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const [classes, setClasses] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [formData, setFormData] = useState({
    course_code: "",
    course_name: "",
    professor: "",
    credit_hours: 3,
    days: [],
    start_time: "",
    end_time: "",
    color: PRESET_COLORS[0],
    semester: "",
    is_active: true,
    category: "Major",
    core_category: ""
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "classes"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const resetForm = () => {
    setFormData({
      course_code: "",
      course_name: "",
      credit_hours: 3,
      days: [],
      start_time: "",
      end_time: "",
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      semester: "",
      is_active: true,
      category: "Major",
      core_category: ""
    });
    setEditingClass(null);
    setShowColorPicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingClass) {
      await updateDoc(doc(db, "classes", editingClass.id), formData);
    } else {
      await addDoc(collection(db, "classes"), { ...formData, uid: user.uid });
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (cls) => {
    setEditingClass(cls);
    setFormData(cls);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
  if (!classToDelete) return;

  try {
    await deleteDoc(doc(db, "classes", classToDelete.id));

    setShowDeleteDialog(false);
    setClassToDelete(null); 
    
  } catch (err) {
    console.error("Error deleting class:", err);
    alert("Failed to delete class: " + err.message);
  }
};

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const toggleActive = async (cls) => {
    await updateDoc(doc(db, "classes", cls.id), { is_active: !cls.is_active });
  };

  const activeClasses = classes.filter(c => c.is_active);
  const inactiveClasses = classes.filter(c => !c.is_active);

  if (!user) return <div className="empty-state">Please sign in to view classes</div>;

  return(
    <div className="classes-container">
      <div className="classes-header">
        <div>
          <h1>My Classes</h1>
          <p>Manage your course schedule</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          + Add Class
        </button>
      </div>
     <div className="classes-section">
        <h2>Active Classes ({activeClasses.length})</h2>
        {activeClasses.length === 0 ? (
          <div className="empty-card">No active classes. Add your first class!</div>
        ) : (
          <div className="classes-grid">
            {activeClasses.map(cls => (
              <div key={cls.id} className="class-card" style={{ borderTopColor: cls.color }}>
                <div className="class-header">
                  <div className="class-color" style={{ backgroundColor: cls.color }}></div>
                  <div className="class-title">
                    <h3>{cls.course_code}</h3>
                    <p>{cls.course_name}</p>
                  </div>
                  <div className="class-actions">
                    <button title="Edit" onClick={() => handleEdit(cls)}>✏️</button>
                    <button title="InActive" onClick={() => toggleActive(cls)}>📦</button>
                    <button title="Delete" onClick={() => {setClassToDelete(cls);   setShowDeleteDialog(true);  }}>🗑️</button>                      
                  </div>
                </div>
                <div className="class-details">
                  {cls.professor && <div className="detail-item"><span>👤</span> {cls.professor}</div>}
                  {cls.start_time && cls.end_time && (
                    <div className="detail-item"><span>🕐</span> {cls.start_time} - {cls.end_time}</div>
                  )}
                  {cls.credit_hours && <div className="detail-item"><span>📚</span> {cls.credit_hours} credits</div>}
                  {cls.days && cls.days.length > 0 && (
                    <div className="class-days">
                      {cls.days.map(day => (
                        <span key={day} className="day-badge">{day.substring(0, 3)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Classes */}
      {inactiveClasses.length > 0 && (
        <div className="classes-section inactive">
          <h2>Past Classes ({inactiveClasses.length})</h2>
          <div className="classes-grid">
            {inactiveClasses.map(cls => (
              <div key={cls.id} className="class-card inactive" style={{ borderTopColor: cls.color }}>
                <div className="class-header">
                  <div className="class-color" style={{ backgroundColor: cls.color }}></div>
                  <div className="class-title">
                    <h3>{cls.course_code}</h3>
                    <p>{cls.course_name}</p>
                  </div>
                  <div className="class-actions">
                    <button onClick={() => toggleActive(cls)} title="Reactivate">🔄</button>
                    <button onClick={() => handleDelete(cls.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showDeleteDialog && (
        <div className="modal-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon">⚠</div>
            <h3>Delete Class?</h3>
            <p>Are you sure you want to delete ?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="dialog-actions">
              <button onClick={() => setShowDeleteDialog(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDelete} className="confirm-delete-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingClass ? "Edit Class" : "Add New Class"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Course Code *</label>
                  <input
                    value={formData.course_code}
                    onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                    placeholder="e.g., CS 2305"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Credit Hours</label>
                  <input
                    type="number"
                    value={formData.credit_hours}
                    onChange={(e) => setFormData({ ...formData, credit_hours: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Course Name *</label>
                <input
                  value={formData.course_name}
                  onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                  placeholder="e.g., Discrete Mathematics"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Professor</label>
                  <input
                    value={formData.professor}
                    onChange={(e) => setFormData({ ...formData, professor: e.target.value })}
                    placeholder="Professor name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Days of Week</label>
                <div className="days-selector">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      className={`day-btn ${formData.days.includes(day) ? 'active' : ''}`}
                      onClick={() => handleDayToggle(day)}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, core_category: e.target.value === 'Core' ? formData.core_category : '' })}
                  >
                    <option value="Major">Major</option>
                    <option value="Core">Core</option>
                    <option value="Minor">Minor</option>
                    <option value="Elective">Elective</option>
                  </select>
                </div>
                {formData.category === 'Core' && (
                  <div className="form-group">
                    <label>Core Category</label>
                    <input
                      value={formData.core_category}
                      onChange={(e) => setFormData({ ...formData, core_category: e.target.value })}
                      placeholder="e.g., Communication"
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Semester</label>
                <input
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  placeholder="e.g., Fall 2025"
                />
              </div>

              {/* Color Picker */}
              <div className="form-group">
                <label>Class Color</label>
                <div className="color-picker-wrapper">
                  <div 
                    className="selected-color"
                    style={{ backgroundColor: formData.color }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    <span>Click to change</span>
                  </div>
                  
                  {showColorPicker && (
                    <div className="color-picker-dropdown">
                      <div className="preset-colors">
                        {PRESET_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            className={`color-btn ${formData.color === color ? 'active' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              setFormData({ ...formData, color });
                              setShowColorPicker(false);
                            }}
                          />
                        ))}
                      </div>
                      <div className="custom-color">
                        <label>Custom:</label>
                        <input
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        />
                        <input
                          type="text"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          placeholder="#000000"
                          className="color-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingClass ? "Update" : "Add"} Class</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
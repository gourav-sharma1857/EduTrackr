import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/Notes.css";

export default function Notes() {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [viewingNote, setViewingNote] = useState(null);

  const [formData, setFormData] = useState({
    class_id: "",
    title: "",
    content: "",
    lecture_date: "",
    tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // Fetch classes
  useEffect(() => {
    if (!user) {
      setClasses([]);
      return;
    }
    const q = query(
      collection(db, "classes"),
      where("uid", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClasses(fetched);
    });
    return () => unsub();
  }, [user]);

  // Fetch notes
  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }
    const q = query(
      collection(db, "notes"),
      where("uid", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort by created_at on client side
      fetched.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
      });
      setNotes(fetched);
    });
    return () => unsub();
  }, [user]);

  const resetForm = () => {
    setFormData({
      class_id: "",
      title: "",
      content: "",
      lecture_date: "",
      tags: [],
    });
    setTagInput("");
    setEditingNote(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to add notes");
      return;
    }

    try {
      if (editingNote) {
        const docRef = doc(db, "notes", editingNote.id);
        await updateDoc(docRef, {
          ...formData,
          updated_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, "notes"), {
          ...formData,
          uid: user.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      resetForm();
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error saving note:", err);
      alert("Failed to save note. Error: " + err.message);
    }
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setFormData({
      class_id: note.class_id || "",
      title: note.title || "",
      content: note.content || "",
      lecture_date: note.lecture_date || "",
      tags: note.tags || [],
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = (note) => {
    setNoteToDelete(note);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!noteToDelete) return;

    try {
      await deleteDoc(doc(db, "notes", noteToDelete.id));
      setShowDeleteDialog(false);
      setNoteToDelete(null);
    } catch (err) {
      console.error("Error deleting note:", err);
      alert("Failed to delete note.");
    }
  };

  const addTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput] });
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesClass = filterClass === "all" || note.class_id === filterClass;

    return matchesSearch && matchesClass;
  });

  // Group notes by class
  const groupedNotes = classes.reduce((acc, cls) => {
    const classNotes = filteredNotes.filter((n) => n.class_id === cls.id);
    if (classNotes.length > 0) {
      acc[cls.id] = { class: cls, notes: classNotes };
    }
    return acc;
  }, {});

  if (!user) {
    return (
      <div className="notes-empty">
        <div className="empty-icon">🔒</div>
        <h2>Please sign in to view notes</h2>
      </div>
    );
  }

  return (
    <div className="notes-container">
      {/* Header */}
      <div className="notes-header">
        <div className="header-actions">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>

          <select
            className="filter-select"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="all">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.course_code}
              </option>
            ))}
          </select>

          <button
            className="add-note-btn"
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <span className="btn-icon">+</span>
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Notes Display */}
      {Object.keys(groupedNotes).length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h2>No notes yet</h2>
          <p>Start taking notes to keep track of your lectures</p>
        </div>
      ) : (
        <div className="notes-grid">
          {Object.values(groupedNotes).map(({ class: cls, notes: classNotes }) => (
            <div key={cls.id} className="class-section">
              <div
                className="class-header"
                style={{
                  borderLeft: `4px solid ${cls.color}`,
                  background: `linear-gradient(135deg, ${cls.color}15 0%, ${cls.color}05 100%)`,
                }}
              >
                <div
                  className="class-icon"
                  style={{ backgroundColor: cls.color }}
                />
                <div className="class-info">
                  <h2 className="class-code">{cls.course_code}</h2>
                  <p className="class-name">{cls.course_name}</p>
                </div>
                <div className="note-count">{classNotes.length} notes</div>
              </div>

              <div className="notes-list">
                {classNotes.map((note) => (
                  <div className="notes-list">
  {classNotes.map((note) => (
    <div 
          key={note.id} 
          className="note-card"
          onClick={() => setViewingNote(note)} 
          style={{ cursor: 'pointer' }}
        >
          <div className="note-header">
            <h3 className="note-title">{note.title}</h3>
            <div className="note-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="action-btn edit-btn"
                onClick={() => handleEdit(note)}
                title="Edit"
              >
                ✎
              </button>
              <button
                className="action-btn delete-btn"
                onClick={() => {
                  setNoteToDelete(note);
                  setShowDeleteDialog(true);
                }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>

          {note.lecture_date && (
            <div className="note-date">
              {new Date(note.lecture_date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}

          {/* Note content snippet */}
          <div className="note-content" style={{
            display: '-webkit-box',
            WebkitLineClamp: '3',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {note.content}
          </div>

          {note.tags && note.tags.length > 0 && (
            <div className="note-tags">
              {note.tags.map((tag, idx) => (
                <span key={idx} className="note-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {viewingNote && (
        <div className="modal-overlay" onClick={() => setViewingNote(null)}>
          <div className="modal-content view-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>{viewingNote.title}</h2>
                <span className="note-date">
                  {viewingNote.lecture_date && new Date(viewingNote.lecture_date).toLocaleDateString()}
                </span>
              </div>
              <button className="close-btn" onClick={() => setViewingNote(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '1.1rem' }}>
                {viewingNote.content}
              </p>
              
              {viewingNote.tags && (
                <div className="note-tags" style={{ marginTop: '2rem' }}>
                  {viewingNote.tags.map((tag, i) => (
                    <span key={i} className="note-tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setViewingNote(null)}>Close</button>
              <button className="submit-btn" onClick={() => {
                handleEdit(viewingNote);
                setViewingNote(null);
              }}>Edit Note</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNote ? "Edit Note" : "New Note"}</h2>
              <button
                className="close-btn"
                onClick={() => setIsDialogOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="note-form">
              <div className="form-group">
                <label>Class *</label>
                <select
                  value={formData.class_id}
                  onChange={(e) =>
                    setFormData({ ...formData, class_id: e.target.value })
                  }
                  required
                  className="form-select"
                >
                  <option value="">Select a class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.course_code} - {cls.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Note title"
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Lecture Date *</label>
                <input
                  type="date"
                  value={formData.lecture_date}
                  onChange={(e) =>
                    setFormData({ ...formData, lecture_date: e.target.value })
                  }
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Your notes..."
                  rows={10}
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tag-input-container">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag"
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="add-tag-btn"
                  >
                    Add
                  </button>
                </div>
                <div className="tags-display">
                  {formData.tags.map((tag, idx) => (
                    <span key={idx} className="tag-chip">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="remove-tag-btn"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingNote ? "Update Note" : "Create Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="modal-overlay" onClick={() => setShowDeleteDialog(false)}>
          <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon">⚠</div>
            <h3>Delete Note?</h3>
            <p>Are you sure you want to delete "{noteToDelete?.title}"?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="dialog-actions">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button onClick={handleDelete} className="confirm-delete-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
import "../styles/ToDoList.css";

const PRIORITIES = ["Low", "Medium", "High"];
const CATEGORIES = ["Personal", "Academic", "Work", "Other"];

export default function ToDoList() {
  const [user, setUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState(null);
  const [showCompleteNotif, setShowCompleteNotif] = useState(false);
  const [completedTodoTitle, setCompletedTodoTitle] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "Medium",
    category: "Personal",
    is_completed: false,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setTodos([]);
      return;
    }
    const q = query(
      collection(db, "todos"),
      where("uid", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      fetched.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
      });
      setTodos(fetched);
    });
    return () => unsub();
  }, [user]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      due_date: "",
      priority: "Medium",
      category: "Personal",
      is_completed: false,
    });
    setEditingTodo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to add tasks");
      return;
    }

    try {
      if (editingTodo) {
        const docRef = doc(db, "todos", editingTodo.id);
        await updateDoc(docRef, {
          ...formData,
          updated_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, "todos"), {
          ...formData,
          uid: user.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      resetForm();
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error saving todo:", err);
      alert("Failed to save task: " + err.message);
    }
  };

  
  const handleEdit = (todo) => {
    setEditingTodo(todo);
    setFormData({
      title: todo.title || "",
      description: todo.description || "",
      due_date: todo.due_date || "",
      priority: todo.priority || "Medium",
      category: todo.category || "Personal",
      is_completed: todo.is_completed || false,
    });
    setIsDialogOpen(true);
  };

  const toggleComplete = async (todo) => {
    try {
      const docRef = doc(db, "todos", todo.id);
      const newStatus = !todo.is_completed;
      await updateDoc(docRef, {
        is_completed: newStatus,
        updated_at: new Date().toISOString(),
      });

      if (newStatus) {
        setCompletedTodoTitle(todo.title);
        setShowCompleteNotif(true);
        setTimeout(() => setShowCompleteNotif(false), 3000);
      }
    } catch (err) {
      console.error("Error toggling todo:", err);
      alert("Failed to update task: " + err.message);
    }
  };

  const confirmDelete = (todo) => {
    setTodoToDelete(todo);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!todoToDelete) return;

    try {
      await deleteDoc(doc(db, "todos", todoToDelete.id));
      setShowDeleteDialog(false);
      setTodoToDelete(null);
    } catch (err) {
      console.error("Error deleting todo:", err);
      alert("Failed to delete task: " + err.message);
    }
  };

  const activeTodos = todos.filter((t) => !t.is_completed);
  const completedTodos = todos.filter((t) => t.is_completed);

  const filterTodos = (todoList) => {
    return todoList.filter((todo) => {
      const matchesPriority =
        filterPriority === "all" || todo.priority === filterPriority;
      const matchesCategory =
        filterCategory === "all" || todo.category === filterCategory;
      return matchesPriority && matchesCategory;
    });
  };

  const filteredActive = filterTodos(activeTodos);
  const filteredCompleted = filterTodos(completedTodos);

  const getPriorityClass = (priority) => {
    switch (priority) {
      case "High":
        return "priority-high";
      case "Medium":
        return "priority-medium";
      case "Low":
        return "priority-low";
      default:
        return "";
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "Personal":
        return "#8b5cf6";
      case "Academic":
        return "#3b82f6";
      case "Work":
        return "#10b981";
      case "Other":
        return "#f59e0b";
      default:
        return "#6366f1";
    }
  };

   if (!user) {
    return (
      <div className="todo-empty">
        <div className="empty-icon">🔒</div>
        <h2>Please sign in to view tasks</h2>
      </div>
    );
  }

  return (
    <div className="todo-container">
      {/* Header */}
      <div className="todo-header">
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-value">{activeTodos.length}</div>
            <div className="stat-label">Active Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{completedTodos.length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {activeTodos.filter((t) => t.priority === "High").length}
            </div>
            <div className="stat-label">High Priority</div>
          </div>
        </div>

        <div className="header-actions">
          <select
            className="filter-select"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            className="add-todo-btn"
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <span className="btn-icon">+</span>
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Active Todos */}
      <div className="todos-section">
        <div className="section-header">
          <h2 className="section-title">Active Tasks</h2>
          <div className="section-badge">{filteredActive.length}</div>
        </div>

        {filteredActive.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>No active tasks. Great job!</p>
          </div>
        ) : (
          <div className="todos-grid">
            {filteredActive.map((todo) => (
              <div key={todo.id} className={`todo-card ${getPriorityClass(todo.priority)}`}>
                <div className="todo-card-header">
                  <button
                    className="checkbox-btn"
                    onClick={() => toggleComplete(todo)}
                  >
                    <div className="checkbox-outer">
                      <div className="checkbox-inner"></div>
                    </div>
                  </button>

                  <div className="todo-info">
                    <h3 className="todo-title">{todo.title}</h3>
                    {todo.description && (
                      <p className="todo-description">{todo.description}</p>
                    )}
                  </div>

                  <div className="todo-actions">
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEdit(todo)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => confirmDelete(todo)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="todo-meta">
                  <span
                    className="category-badge"
                    style={{
                      backgroundColor: `${getCategoryColor(todo.category)}20`,
                      borderColor: getCategoryColor(todo.category),
                      color: getCategoryColor(todo.category),
                    }}
                  >
                    {todo.category}
                  </span>

                  <span className={`priority-badge ${getPriorityClass(todo.priority)}`}>
                    {todo.priority}
                  </span>

                  {todo.due_date && (
                    <span className="due-date">
                      Due: {new Date(todo.due_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Todos */}
      {filteredCompleted.length > 0 && (
        <div className="todos-section completed-section">
          <div className="section-header">
            <h2 className="section-title">Completed Tasks</h2>
            <div className="section-badge">{filteredCompleted.length}</div>
          </div>

          <div className="todos-grid">
            {filteredCompleted.map((todo) => (
              <div key={todo.id} className="todo-card completed">
                <div className="todo-card-header">
                  <button
                    className="checkbox-btn checked"
                    onClick={() => toggleComplete(todo)}
                  >
                    <div className="checkbox-outer">
                      <div className="checkbox-inner checked">✓</div>
                    </div>
                  </button>

                  <div className="todo-info">
                    <h3 className="todo-title">{todo.title}</h3>
                    {todo.description && (
                      <p className="todo-description">{todo.description}</p>
                    )}
                  </div>

                  <button
                    className="action-btn delete-btn"
                    onClick={() => confirmDelete(todo)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>

                <div className="todo-meta">
                  <span
                    className="category-badge"
                    style={{
                      backgroundColor: `${getCategoryColor(todo.category)}20`,
                      borderColor: getCategoryColor(todo.category),
                      color: getCategoryColor(todo.category),
                    }}
                  >
                    {todo.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTodo ? "Edit Task" : "New Task"}</h2>
              <button className="close-btn" onClick={() => setIsDialogOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="todo-form">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="What needs to be done?"
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Add details..."
                  rows={4}
                  className="form-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="form-select"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="form-select"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  className="form-input"
                />
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
                  {editingTodo ? "Update Task" : "Create Task"}
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
            <h3>Delete Task?</h3>
            <p>Are you sure you want to delete "{todoToDelete?.title}"?</p>
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

      {/* Completion Notification */}
      {showCompleteNotif && (
        <div className="complete-notification">
          <div className="notif-icon">✓</div>
          <div className="notif-content">
            <div className="notif-title">Task Completed!</div>
            <div className="notif-message">{completedTodoTitle}</div>
          </div>
        </div>
      )}
    </div>
  );


}
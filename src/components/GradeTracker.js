import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, setDoc,deleteDoc, getDoc ,addDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/GradeTracker.css";

export default function GradeTracker() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [completedAssignments, setCompletedAssignments] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [earnedPoints, setEarnedPoints] = useState("");
  const [categoryWeights, setCategoryWeights] = useState({});
  const [anticipatedGrades, setAnticipatedGrades] = useState({});
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [manualData, setManualData] = useState({
    title: "",
    category: "Assignment",
    total_points: "",
    earned_points: "",
    class_id: ""
    });

  const handleManualSubmit = async (e) => {
  e.preventDefault();
  if (!user || !manualData.class_id) return;

  const newAssignment = {
    ...manualData,
    uid: user.uid,
    total_points: Number(manualData.total_points),
    earned_points: Number(manualData.earned_points),
    is_completed: true,
    is_graded: true,
    created_at: new Date()
  };

    await addDoc(collection(db, "assignments"), newAssignment);
    setIsManualModalOpen(false);
    setManualData({ title: "", category: "Assignment", total_points: "", earned_points: "", class_id: "" });
  };

  const toggleCategory = (key) => {
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const sortByDueDate = (assignments) => {
    return [...assignments].sort((a, b) => {
      const dateA = new Date(a.due_date || '9999-12-31');
      const dateB = new Date(b.due_date || '9999-12-31');
      return dateA - dateB;
    });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadWeights = async () => {
      const weightsDoc = await getDoc(doc(db, "categoryWeights", user.uid));
      if (weightsDoc.exists()) {
        setCategoryWeights(weightsDoc.data().weights || {});
      }
    };
    loadWeights();
  }, [user]);

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
    const q = query(collection(db, "assignments"), where("uid", "==", user.uid), where("is_completed", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      setCompletedAssignments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "assignments"), where("uid", "==", user.uid), where("is_completed", "==", false));
    const unsub = onSnapshot(q, (snapshot) => {
      setPendingAssignments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const handleWeightChange = async (classId, category, value) => {
    const newWeights = { ...categoryWeights, [`${classId}_${category}`]: Number(value) };
    setCategoryWeights(newWeights);
    if (user) {
      await setDoc(doc(db, "categoryWeights", user.uid), { weights: newWeights }, { merge: true });
    }
  };

  const handleAddGrade = (assignment) => {
    setSelectedAssignment(assignment);
    setEarnedPoints(assignment.earned_points || "");
    setIsDialogOpen(true);
  };

  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "assignments", selectedAssignment.id), {
      earned_points: Number(earnedPoints),
      is_graded: true
    });
    setIsDialogOpen(false);
    setSelectedAssignment(null);
    setEarnedPoints("");
  };
  const confirmDelete = (assignment) => {
  setIsDialogOpen(false);      
  setIsManualModalOpen(false); 
  setAssignmentToDelete(assignment);
  setIsDeleteDialogOpen(true);
};

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;

    try {
      await deleteDoc(doc(db, "assignments", assignmentToDelete.id));
      setIsDeleteDialogOpen(false);
      setAssignmentToDelete(null);
      console.log("Deleted successfully from Firebase");
    } catch (err) {
      console.error("Error deleting assignment:", err);
      alert("Failed to delete the grade.");
    }
  };

  const calculateWeightedGrade = (classId, includeAnticipated = false) => {
    const gradedAssignments = completedAssignments.filter((a) => a.class_id === classId && a.is_graded);
    const classPending = pendingAssignments.filter(a => a.class_id === classId);
    
    const allCategories = new Set();
    gradedAssignments.forEach(a => allCategories.add(a.category || 'Other'));
    if (includeAnticipated) {
      classPending.forEach(a => {
        if (anticipatedGrades[a.id] > 0) {
          allCategories.add(a.category || 'Other');
        }
      });
    }

    // Calculate per-category scores
    const categoryScores = {};
    allCategories.forEach(cat => {
      let catTotal = 0;
      let catEarned = 0;
      
      // Graded assignments
      gradedAssignments.filter(a => (a.category || 'Other') === cat).forEach(a => {
        catTotal += a.total_points || 0;
        catEarned += a.earned_points || 0;
      });
      
      // Anticipated assignments
      if (includeAnticipated) {
        classPending.filter(a => (a.category || 'Other') === cat).forEach(a => {
          const anticipated = anticipatedGrades[a.id];
          if (anticipated > 0) {
            catTotal += a.total_points || 0;
            catEarned += (anticipated / 100) * (a.total_points || 0);
          }
        });
      }
      
      if (catTotal > 0) {
        categoryScores[cat] = {
          percentage: (catEarned / catTotal) * 100,
          weight: categoryWeights[`${classId}_${cat}`] || 0
        };
      }
    });

    // Check if weights are set
    const totalWeight = Object.values(categoryScores).reduce((sum, c) => sum + c.weight, 0);
    
    if (totalWeight > 0 && totalWeight <= 100) {
      // Weighted calculation
      let weightedSum = 0;
      let usedWeight = 0;
      Object.values(categoryScores).forEach(c => {
        if (c.weight > 0) {
          weightedSum += c.percentage * (c.weight / 100);
          usedWeight += c.weight;
        }
      });
      return usedWeight > 0 ? (weightedSum / usedWeight) * 100 : null;
    } else {
      // Simple point-based calculation
      let totalPoints = 0;
      let earnedPointsSum = 0;
      
      gradedAssignments.forEach(a => {
        totalPoints += a.total_points || 0;
        earnedPointsSum += a.earned_points || 0;
      });
      
      if (includeAnticipated) {
        classPending.forEach(a => {
          const anticipated = anticipatedGrades[a.id];
          if (anticipated > 0) {
            totalPoints += a.total_points || 0;
            earnedPointsSum += (anticipated / 100) * (a.total_points || 0);
          }
        });
      }
      
      return totalPoints > 0 ? (earnedPointsSum / totalPoints) * 100 : null;
    }
  };

  const getLetterGrade = (percentage) => {
    if (percentage >= 93) return "A";
    if (percentage >= 90) return "A-";
    if (percentage >= 87) return "B+";
    if (percentage >= 83) return "B";
    if (percentage >= 80) return "B-";
    if (percentage >= 77) return "C+";
    if (percentage >= 73) return "C";
    if (percentage >= 70) return "C-";
    if (percentage >= 67) return "D+";
    if (percentage >= 63) return "D";
    if (percentage >= 60) return "D-";
    return "F";
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 90) return "#10b981";
    if (percentage >= 80) return "#3b82f6";
    if (percentage >= 70) return "#f59e0b";
    if (percentage >= 60) return "#f97316";
    return "#ef4444";
  };

  if (!user) {
    return <div className="empty-state">Please sign in to view grades</div>;
  }

  // Group by class - include classes with any assignments (completed or pending)
  const groupedByClass = {};
  classes.forEach((cls) => {
    const classCompleted = completedAssignments.filter((a) => a.class_id === cls.id);
    const classPending = pendingAssignments.filter((a) => a.class_id === cls.id);
    if (classCompleted.length > 0 || classPending.length > 0) {
      groupedByClass[cls.id] = { 
        class: cls, 
        assignments: classCompleted,
        pending: classPending
      };
    }
  });

  return (
    <div className="grade-tracker-container">
      <div className="grade-tracker-header">
        <h1>Grade Tracker</h1>
        <p>Monitor your academic performance and anticipate future grades</p>
      </div>
      <button className="btn-primary" onClick={() => setIsManualModalOpen(true)}>
         + Quick Add Grade
      </button>

      {Object.keys(groupedByClass).length === 0 ? (
        <div className="empty-state-card">No assignments yet. Add assignments to track grades!</div>
      ) : (
        <div className="classes-grid">
          {Object.values(groupedByClass).map(({ class: cls, assignments: classAssignments, pending: classPending }) => {
            const currentGrade = calculateWeightedGrade(cls.id, false);
            const anticipatedGrade = calculateWeightedGrade(cls.id, true);
            const gradedCount = classAssignments.filter((a) => a.is_graded).length;
            
            // Get all categories from both graded and pending
            const allCategories = [...new Set([
              ...classAssignments.map(a => a.category || 'Other'),
              ...classPending.map(a => a.category || 'Other')
            ])];

            return (
              <div key={cls.id} className="class-grade-card" style={{ borderLeftColor: cls.color }}>
                <div className="class-grade-header">
                  <div className="class-info">
                    <h2>{cls.course_code}</h2>
                    <p>{cls.course_name}</p>
                  </div>
                  <div className="grades-display">
                    {currentGrade !== null && (
                      <div className="current-grade" style={{ backgroundColor: `${getGradeColor(currentGrade)}20` }}>
                        <span className="grade-value" style={{ color: getGradeColor(currentGrade) }}>{currentGrade.toFixed(1)}%</span>
                        <span className="grade-letter">Current: {getLetterGrade(currentGrade)}</span>
                      </div>
                    )}
                    {anticipatedGrade !== null && anticipatedGrade !== currentGrade && (
                      <div className="anticipated-grade">
                        <span className="grade-value" style={{ color: getGradeColor(anticipatedGrade) }}>{anticipatedGrade.toFixed(1)}%</span>
                        <span className="grade-letter">Projected: {getLetterGrade(anticipatedGrade)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grade-stats">
                  <span>{classAssignments.length} completed</span>
                  <span>{gradedCount} graded</span>
                  <span>{classPending.length} pending</span>
                </div>

                {/* Category Weights Section */}
                {allCategories.length > 0 && (
                  <div className="category-weights-section">
                    <h3>📊 Category Weights</h3>
                    <p className="weights-hint">Set weights for weighted grade calculation (should total 100%)</p>
                    <div className="weights-grid">
                      {allCategories.map((cat) => {
                        const weight = categoryWeights[`${cls.id}_${cat}`] || 0;
                        return (
                          <div key={cat} className="weight-input-row">
                            <label>{cat}</label>
                            <div className="weight-input-wrapper">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={weight}
                                onChange={(e) => handleWeightChange(cls.id, cat, e.target.value)}
                              />
                              <span>%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="weight-total">
                      Total: {allCategories.reduce((sum, cat) => sum + (categoryWeights[`${cls.id}_${cat}`] || 0), 0)}%
                    </div>
                  </div>
                )}

                {/* Graded Assignments */}
                {/* Graded Assignments */}
{classAssignments.length > 0 && (
  <div className="assignments-section">
    <h3>✅ Graded Assignments</h3>
    {(() => {
      const groupedByCategory = {};
      classAssignments.forEach(assignment => {
        const cat = assignment.category || 'Other';
        if (!groupedByCategory[cat]) {
          groupedByCategory[cat] = [];
        }
        groupedByCategory[cat].push(assignment);
      });

      return Object.keys(groupedByCategory).map((category) => {
        const categoryKey = `graded-${cls.id}-${category}`;
        const isExpanded = expandedCategories[categoryKey] !== false;
        const categoryAssignments = sortByDueDate(groupedByCategory[category]);

        return (
          <div key={category} className="category-folder">
            <div className="category-header" onClick={() => toggleCategory(categoryKey)}>
              <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
              <span className="category-name">{category}</span>
              <span className="category-count">({categoryAssignments.length})</span>
              <span className="toggle-arrow">{isExpanded ? '▼' : '▶'}</span>
            </div>
            {isExpanded && (
              <div className="category-content">
                {categoryAssignments.map((assignment) => (
                  <div key={assignment.id} className="assignment-grade-item">
                    <div className="assignment-grade-info">
                      <h4>{assignment.title}</h4>
                      <div className="assignment-badges">
                        <span className="badge-points">{assignment.total_points} pts</span>
                        {assignment.due_date && (
                          <span className="badge-duedate">{new Date(assignment.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      {assignment.is_graded ? (
                        <div className="grade-display" style={{ color: getGradeColor((assignment.earned_points / assignment.total_points) * 100) }}>
                          {assignment.earned_points}/{assignment.total_points} pts ({((assignment.earned_points / assignment.total_points) * 100).toFixed(1)}%)
                        </div>
                      ) : (
                        <span className="not-graded">Not graded yet</span>
                      )}
                    </div>
                    
                    <div className="assignment-actions">
                      <button className="btn-small" onClick={() => handleAddGrade(assignment)}>
                        {assignment.is_graded ? "Edit" : "Add Grade"}
                      </button>
                      <button 
                        className="btn-delete-icon" 
                        onClick={(e) => {
                          e.stopPropagation(); 
                          confirmDelete(assignment);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      });
    })()}
  </div>
)}

                {/* Grade Anticipator */}
                {classPending.length > 0 && (
                  <div className="anticipator-section">
                    <h3>🎯 Grade Anticipator</h3>
                    <p className="anticipator-hint">Adjust sliders to see how future grades affect your overall grade</p>
                    {(() => {
                      const groupedByCategory = {};
                      classPending.forEach(assignment => {
                        const cat = assignment.category || 'Other';
                        if (!groupedByCategory[cat]) {
                          groupedByCategory[cat] = [];
                        }
                        groupedByCategory[cat].push(assignment);
                      });

                      return Object.keys(groupedByCategory).map((category) => {
                        const categoryKey = `anticipator-${cls.id}-${category}`;
                        const isExpanded = expandedCategories[categoryKey] !== false;
                        const categoryAssignments = sortByDueDate(groupedByCategory[category]);

                        return (
                          <div key={category} className="category-folder anticipator-category">
                            <div className="category-header anticipator-header" onClick={() => toggleCategory(categoryKey)}>
                              <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
                              <span className="category-name">{category}</span>
                              <span className="category-count">({categoryAssignments.length})</span>
                              <span className="toggle-arrow">{isExpanded ? '▼' : '▶'}</span>
                            </div>
                            {isExpanded && (
                              <div className="category-content anticipator-content">
                                {categoryAssignments.map((assignment) => (
                                  <div key={assignment.id} className="anticipator-item">
                                    <div className="anticipator-info">
                                      <h4>{assignment.title}</h4>
                                      <div className="anticipator-badges">
                                        <span className="badge-points">{assignment.total_points} pts</span>
                                        {assignment.due_date && (
                                          <span className="badge-duedate">{new Date(assignment.due_date).toLocaleDateString()}</span>
                                        )}
                                        {categoryWeights[`${cls.id}_${assignment.category}`] > 0 && (
                                          <span className="badge-weight">{categoryWeights[`${cls.id}_${assignment.category}`]}% weight</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="anticipator-slider">
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={anticipatedGrades[assignment.id] || 0}
                                        onChange={(e) => setAnticipatedGrades({
                                          ...anticipatedGrades,
                                          [assignment.id]: Number(e.target.value)
                                        })}
                                      />
                                      <span className="slider-value" style={{ color: getGradeColor(anticipatedGrades[assignment.id] || 0) }}>
                                        {anticipatedGrades[assignment.id] || 0}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isManualModalOpen && (
  <div className="modal-overlay" onClick={() => setIsManualModalOpen(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h2>Add Manual Grade</h2>
      <form onSubmit={handleManualSubmit}>
        <div className="form-group">
          <label>Class *</label>
          <select 
            required 
            value={manualData.class_id} 
            onChange={(e) => setManualData({...manualData, class_id: e.target.value})}
          >
            <option value="">Select a class</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.course_code}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Assignment Title *</label>
          <input 
            required 
            type="text" 
            placeholder="e.g. Midterm Exam" 
            value={manualData.title}
            onChange={(e) => setManualData({...manualData, title: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Category</label>
          <input 
            type="text" 
            placeholder="e.g. Exam, Homework" 
            value={manualData.category}
            onChange={(e) => setManualData({...manualData, category: e.target.value})}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Points Earned</label>
            <input 
              required type="number" 
              value={manualData.earned_points}
              onChange={(e) => setManualData({...manualData, earned_points: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Total Points</label>
            <input 
              required type="number" 
              value={manualData.total_points}
              onChange={(e) => setManualData({...manualData, total_points: e.target.value})}
            />
          </div>
        </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsManualModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add to Tracker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grade Entry Modal */}
      {isDialogOpen && selectedAssignment && (
        <div className="modal-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedAssignment.is_graded ? "Update Grade" : "Add Grade"}</h2>
            <form onSubmit={handleSubmitGrade}>
              <div className="assignment-details">
                <p><strong>Assignment:</strong> {selectedAssignment.title}</p>
                <p><strong>Category:</strong> {selectedAssignment.category}</p>
                <p><strong>Total Points:</strong> {selectedAssignment.total_points}</p>
              </div>
              <div className="form-group">
                <label>Points Earned *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  max={selectedAssignment.total_points} 
                  value={earnedPoints} 
                  onChange={(e) => setEarnedPoints(e.target.value)} 
                  placeholder="Enter points earned" 
                  required 
                />
              </div>
              {earnedPoints && (
                <div className="grade-preview">
                  Percentage: {((earnedPoints / selectedAssignment.total_points) * 100).toFixed(2)}%
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Grade</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDeleteDialogOpen && (
          <div className="modal-overlay" onClick={() => setIsDeleteDialogOpen(false)}>
            <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="delete-icon">⚠</div>
              <h3>Delete Grade?</h3>
              <p>Are you sure you want to delete <strong>{assignmentToDelete?.title}</strong>?</p>
              <p className="warning-text">This action cannot be undone.</p>
              <div className="dialog-actions">
                <button onClick={() => setIsDeleteDialogOpen(false)} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={handleDeleteAssignment} className="confirm-delete-btn">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
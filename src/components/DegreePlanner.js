import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/DegreePlanner.css";

export default function DegreePlanner() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentClasses, setCurrentClasses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [coreReqs, setCoreReqs] = useState([]);
  const [majorReqs, setMajorReqs] = useState([]);
  const [minorReqs, setMinorReqs] = useState([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState(null);
  const [degreeSettings, setDegreeSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("semesters");
  const [isSemesterDialogOpen, setIsSemesterDialogOpen] = useState(false);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [semesterData, setSemesterData] = useState({ name: "" });
  const [courseData, setCourseData] = useState({
    course_code: "",
    course_name: "",
    credit_hours: 3,
    category: "Major",
    core_category: "",
    status: "Not Started"
  });

  const statusOptions = ["Not Started", "In Progress", "Completed", "Transferred"];
  const categoryOptions = ["Core", "Major", "Minor", "Elective"];

  const defaultCoreCategories = [
    { id: "010", name: "Communication", credits: 6 },
    { id: "020", name: "Mathematics", credits: 3 },
    { id: "030", name: "Life & Physical Sciences", credits: 6 },
    { id: "040", name: "Language, Philosophy & Culture", credits: 3 },
    { id: "050", name: "Creative Arts", credits: 3 },
    { id: "060", name: "American History", credits: 6 },
    { id: "070", name: "Government/Political Science", credits: 6 },
    { id: "080", name: "Social & Behavioral Sciences", credits: 3 },
    { id: "090", name: "Component Area Option", credits: 6 }
  ];

  const [coreCategories, setCoreCategories] = useState(defaultCoreCategories);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      if (profileDoc.exists()) setUserProfile(profileDoc.data());

      const settingsDoc = await getDoc(doc(db, "degreeSettings", user.uid));
      if (settingsDoc.exists()) {
        setDegreeSettings(settingsDoc.data());
        if (settingsDoc.data().coreCategories) {
          setCoreCategories(settingsDoc.data().coreCategories);
        }
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "classes"), where("uid", "==", user.uid), where("is_active", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      setCurrentClasses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "degreeSemesters"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSemesters(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "coreRequirements"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => setCoreReqs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "majorRequirements"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => setMajorReqs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "minorRequirements"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => setMinorReqs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, [user]);

  const saveCoreCategories = async (newCategories) => {
    setCoreCategories(newCategories);
    await setDoc(doc(db, "degreeSettings", user.uid), {
      ...degreeSettings,
      coreCategories: newCategories
    }, { merge: true });
  };

  const updateCoreCategory = (categoryId, field, value) => {
    const updated = coreCategories.map(cat =>
      cat.id === categoryId ? { ...cat, [field]: field === 'credits' ? Number(value) : value } : cat
    );
    saveCoreCategories(updated);
  };

  // Get core courses from all sources - current classes, manual entries, AND semester courses
  const getCoreCoursesForCategory = (categoryName) => {
    // From current classes
    const fromCurrentClasses = currentClasses.filter(c => 
      c.category === "Core" && c.core_category === categoryName
    );
    
    // From manual entries
    const fromManual = coreReqs.filter(c => c.category === categoryName);
    
    // From semester courses that are Core category
    const fromSemesters = semesters.flatMap(sem => 
      (sem.courses || [])
        .filter(c => c.category === "Core" && c.core_category === categoryName)
        .map(c => ({ ...c, source: 'semester', semesterName: sem.name }))
    );
    
    return [
      ...fromCurrentClasses.map(c => ({ ...c, source: 'class' })),
      ...fromManual.map(c => ({ ...c, source: 'manual' })),
      ...fromSemesters
    ];
  };

  // Get major courses from all sources
  const getMajorCourses = () => {
    const fromCurrentClasses = currentClasses.filter(c => c.category === "Major");
    const fromManual = majorReqs;
    
    // From semester courses that are Major category
    const fromSemesters = semesters.flatMap(sem => 
      (sem.courses || [])
        .filter(c => c.category === "Major")
        .map(c => ({ ...c, source: 'semester', semesterName: sem.name }))
    );
    
    return [
      ...fromCurrentClasses.map(c => ({ ...c, source: 'class' })),
      ...fromManual.map(c => ({ ...c, source: 'manual' })),
      ...fromSemesters
    ];
  };

  // Get minor courses from all sources
  const getMinorCourses = () => {
    const fromCurrentClasses = currentClasses.filter(c => c.category === "Minor");
    const fromManual = minorReqs;
    
    // From semester courses that are Minor category
    const fromSemesters = semesters.flatMap(sem => 
      (sem.courses || [])
        .filter(c => c.category === "Minor")
        .map(c => ({ ...c, source: 'semester', semesterName: sem.name }))
    );
    
    return [
      ...fromCurrentClasses.map(c => ({ ...c, source: 'class' })),
      ...fromManual.map(c => ({ ...c, source: 'manual' })),
      ...fromSemesters
    ];
  };

  // Calculate overall progress - FIXED to avoid any double counting
  const calculateProgress = () => {
    const totalRequired = userProfile?.degree_credit_requirement || 120;
    
    // Get all unique completed courses from all sources
    const completedCourses = new Map(); // Use Map to avoid duplicates by course_code
    const transferredCourses = new Map(); // separate map for transferred credits

    // Helper to add to a map without duplicating
    const addToMap = (map, key, credits) => {
      if (!map.has(key)) map.set(key, credits || 0);
    };

    // 1. Manual core requirements
    coreReqs.forEach(c => {
      const key = `${c.course_code}-core`;
      if (c.status === 'Transferred' || c.is_transfer) {
        addToMap(transferredCourses, key, c.credit_hours);
      } else if (c.status === 'Completed') {
        addToMap(completedCourses, key, c.credit_hours);
      }
    });

    // 2. Manual major requirements
    majorReqs.forEach(c => {
      const key = `${c.course_code}-major`;
      if (c.is_transfer || c.status === 'Transferred') {
        addToMap(transferredCourses, key, c.credit_hours);
      } else if (c.is_completed) {
        addToMap(completedCourses, key, c.credit_hours);
      }
    });

    // 3. Manual minor requirements
    minorReqs.forEach(c => {
      const key = `${c.course_code}-minor`;
      if (c.is_transfer || c.status === 'Transferred') {
        addToMap(transferredCourses, key, c.credit_hours);
      } else if (c.is_completed) {
        addToMap(completedCourses, key, c.credit_hours);
      }
    });

    // 4. Semester courses
    semesters.forEach(sem => {
      (sem.courses || []).forEach(c => {
        const key = `${c.course_code}-semester`;
        if (c.status === 'Transferred' || c.is_transfer) {
          addToMap(transferredCourses, key, c.credit_hours);
        } else if (c.status === 'Completed') {
          addToMap(completedCourses, key, c.credit_hours);
        }
      });
    });

    // 5. Current classes (some may be completed in DB)
    currentClasses.forEach(c => {
      const key = `${c.course_code}-current`;
      if (c.is_transfer || c.status === 'Transferred') {
        addToMap(transferredCourses, key, c.credit_hours);
      } else if (c.is_completed || c.status === 'Completed') {
        addToMap(completedCourses, key, c.credit_hours);
      }
    });

    // Sum all completed credits (no duplicates)
    const completedFromCourses = Array.from(completedCourses.values()).reduce((sum, credits) => sum + credits, 0);

    // Sum transferred credits from course entries
    const transferredFromCourses = Array.from(transferredCourses.values()).reduce((sum, credits) => sum + credits, 0);

    // If the user added explicit transferred courses in planner, prefer that total
    // to avoid double-counting with the profile's `completed_credit_hours` field.
    const profileTransferred = Number(userProfile?.completed_credit_hours || 0);
    const transferredCredits = transferredFromCourses > 0 ? transferredFromCourses : profileTransferred;

    // In progress courses
    const inProgressCourses = new Map();
    
    // Current classes (always in progress)
    currentClasses.forEach(cls => {
      const key = `${cls.course_code}-current`;
      if (!inProgressCourses.has(key)) {
        inProgressCourses.set(key, cls.credit_hours || 0);
      }
    });

    // In progress from semesters
    semesters.forEach(sem => {
      (sem.courses || [])
        .filter(c => c.status === "In Progress" || c.status === "Not Started")
        .forEach(c => {
          const key = `${c.course_code}-semester-progress`;
          if (!inProgressCourses.has(key)) {
            inProgressCourses.set(key, c.credit_hours || 0);
          }
        });
    });

    const totalInProgress = Array.from(inProgressCourses.values()).reduce((sum, credits) => sum + credits, 0);
    
    const combinedCompleted = transferredCredits + completedFromCourses;
    const remaining = Math.max(0, totalRequired - combinedCompleted - totalInProgress);
    const percentage = Math.min((combinedCompleted / totalRequired) * 100, 100);

    return {
      completedCredits: completedFromCourses,
      transferredCredits,
      combinedCompleted,
      inProgressCredits: totalInProgress,
      remaining,
      totalRequired,
      percentage
    };
  };

  // Calculate minor progress
  const calculateMinorProgress = () => {
    const minorSettings = degreeSettings?.minorCreditsRequired || 18;
    
    // Completed from manual minor requirements
    const completedMinorCredits = minorReqs
      .filter(c => c.is_completed)
      .reduce((sum, c) => sum + (c.credit_hours || 0), 0);

    // In progress from current classes
    const inProgressMinor = currentClasses
      .filter(c => c.category === "Minor")
      .reduce((sum, c) => sum + (c.credit_hours || 0), 0);

    const percentage = Math.min((completedMinorCredits / minorSettings) * 100, 100);

    return {
      completed: completedMinorCredits,
      inProgress: inProgressMinor,
      required: minorSettings,
      percentage
    };
  };

  const handleAddSemester = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "degreeSemesters"), {
      ...semesterData,
      uid: user.uid,
      courses: [],
      order: semesters.length + 1
    });
    setIsSemesterDialogOpen(false);
    setSemesterData({ name: "" });
  };

  const triggerDeleteSemester = (semester) => {
  setSemesterToDelete(semester);
  setIsDeleteDialogOpen(true);
};

const handleConfirmDeleteSemester = async () => {
  if (!semesterToDelete) return;
  try {
    await deleteDoc(doc(db, "degreeSemesters", semesterToDelete.id));
    setIsDeleteDialogOpen(false);
    setSemesterToDelete(null);
  } catch (error) {
    console.error("Error deleting semester:", error);
  }
};

  // Add course ONLY to semester (not to requirement collections)
  const handleAddCourseToSemester = async (e) => {
    e.preventDefault();
    const semester = semesters.find(s => s.id === selectedSemester);
    if (!semester) return;

    const newCourse = {
      ...courseData,
      id: Date.now().toString()
    };

    const updatedCourses = [...(semester.courses || []), newCourse];
    await updateDoc(doc(db, "degreeSemesters", selectedSemester), {
      courses: updatedCourses
    });

    setIsCourseDialogOpen(false);
    setCourseData({
      course_code: "",
      course_name: "",
      credit_hours: 3,
      category: "Major",
      core_category: "",
      status: "Not Started"
    });
  };

  const handleUpdateSemesterCourse = async (semesterId, courseId, field, value) => {
    const semester = semesters.find(s => s.id === semesterId);
    if (!semester) return;

    const updatedCourses = semester.courses.map(c =>
      c.id === courseId ? { ...c, [field]: value } : c
    );

    await updateDoc(doc(db, "degreeSemesters", semesterId), {
      courses: updatedCourses
    });
  };

  const handleDeleteSemesterCourse = async (semesterId, courseId) => {
    const semester = semesters.find(s => s.id === semesterId);
    if (!semester) return;

    const updatedCourses = semester.courses.filter(c => c.id !== courseId);
    await updateDoc(doc(db, "degreeSemesters", semesterId), {
      courses: updatedCourses
    });
  };

  // Core CRUD
  const handleUpdateCore = async (coreId, field, value) => {
    await updateDoc(doc(db, "coreRequirements", coreId), { [field]: value });
  };

  const handleDeleteCore = async (id) => {
    await deleteDoc(doc(db, "coreRequirements", id));
  };

  // Major CRUD
  const handleUpdateMajor = async (majorId, field, value) => {
    await updateDoc(doc(db, "majorRequirements", majorId), { [field]: value });
  };

  const handleDeleteMajor = async (id) => {
    await deleteDoc(doc(db, "majorRequirements", id));
  };

  // Minor CRUD
  const handleUpdateMinor = async (minorId, field, value) => {
    await updateDoc(doc(db, "minorRequirements", minorId), { [field]: value });
  };

  const handleDeleteMinor = async (id) => {
    await deleteDoc(doc(db, "minorRequirements", id));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, "degreeSettings", user.uid), degreeSettings, { merge: true });
    setIsSettingsDialogOpen(false);
  };

  const progress = calculateProgress();
  const minorProgress = calculateMinorProgress();

  if (!user) {
    return <div className="empty-state">Please sign in to view degree planner</div>;
  }

  return (
    <div className="degree-planner-container">
      <div className="degree-planner-header">
        <div>
          <h1>Degree Planner</h1>
          <p>Plan your academic journey</p>
        </div>
        <button className="btn-settings" onClick={() => setIsSettingsDialogOpen(true)}>⚙️ Settings</button>
      </div>

      {/* Summary Cards */}
      <div className="summary-section">
        <h2>Degree Progress</h2>
        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-value">{progress.completedCredits}</span>
            <span className="summary-label">Completed</span>
          </div>
          <div className="summary-card green">
            <span className="summary-value">{progress.transferredCredits}</span>
            <span className="summary-label">Transferred</span>
          </div>
          <div className="summary-card blue">
            <span className="summary-value">{progress.inProgressCredits}</span>
            <span className="summary-label">In Progress</span>
          </div>
          <div className="summary-card red">
            <span className="summary-value">{progress.remaining}</span>
            <span className="summary-label">Remaining</span>
          </div>
        </div>
          <div className="progress-section">
          <span className="progress-label">Overall: {progress.combinedCompleted}/{progress.totalRequired}</span>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }}></div>
          </div>
          <span className="progress-percentage">{progress.percentage.toFixed(0)}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === "semesters" ? "active" : ""}`} onClick={() => setActiveTab("semesters")}>
             Semesters
          </button>
          <button className={`tab-btn ${activeTab === "core" ? "active" : ""}`} onClick={() => setActiveTab("core")}>
             Core
          </button>
          <button className={`tab-btn ${activeTab === "major" ? "active" : ""}`} onClick={() => setActiveTab("major")}>
             Major
          </button>
          <button className={`tab-btn ${activeTab === "minor" ? "active" : ""}`} onClick={() => setActiveTab("minor")}>
             Minor
          </button>
        </div>

        {/* Semesters Tab */}
        {activeTab === "semesters" && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Semester Plans</h3>
              <button className="btn-add-req" onClick={() => setIsSemesterDialogOpen(true)}>+ Add Semester</button>
            </div>

            {/* Current Classes */}
            {currentClasses.length > 0 && (
              <div className="semester-block current">
                <div className="semester-block-header">
                  <h3>📍 Current Semester</h3>
                  <span className="semester-credits">{currentClasses.reduce((sum, c) => sum + (c.credit_hours || 0), 0)} credits</span>
                </div>
                <div className="semester-courses-table">
                  <div className="table-header-5">
                    <span>Code</span>
                    <span>Name</span>
                    <span>Hrs</span>
                    <span>Category</span>
                    <span>Core Type</span>
                  </div>
                  {currentClasses.map(cls => (
                    <div key={cls.id} className="table-row-5">
                      <span className="course-code">{cls.course_code}</span>
                      <span className="course-name">{cls.course_name}</span>
                      <span>{cls.credit_hours}</span>
                      <span className="category-badge">{cls.category || "Major"}</span>
                      <span className="core-type">{cls.core_category[0] || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Planned Semesters */}
            {semesters.map(semester => {
              const semesterTotalCredits = (semester.courses || []).reduce((sum, c) => sum + (c.credit_hours || 0), 0);
              return (
                <div key={semester.id} className="semester-block">
                  <div className="semester-block-header">
                    <h3>{semester.name}</h3>
                    <span className="semester-credits">{semesterTotalCredits} credits</span>
                    <button className="btn-delete-sm" onClick={() => triggerDeleteSemester(semester)}>🗑️</button>                  </div>
                  <div className="semester-courses-table">
                    <div className="table-header-6">
                      <span>Code</span>
                      <span>Name</span>
                      <span>Hrs</span>
                      <span>Status</span>
                      <span>Category</span>
                      <span></span>
                    </div>
                    {(semester.courses || []).map(course => (
                      <div key={course.id} className="table-row-6">
                        <input
                          className="table-input"
                          value={course.course_code}
                          onChange={(e) => handleUpdateSemesterCourse(semester.id, course.id, 'course_code', e.target.value)}
                        />
                        <input
                          className="table-input wide"
                          value={course.course_name}
                          onChange={(e) => handleUpdateSemesterCourse(semester.id, course.id, 'course_name', e.target.value)}
                        />
                        <input
                          className="table-input small"
                          type="number"
                          value={course.credit_hours}
                          onChange={(e) => handleUpdateSemesterCourse(semester.id, course.id, 'credit_hours', Number(e.target.value))}
                        />
                        <select
                          className="table-select"
                          value={course.status}
                          onChange={(e) => handleUpdateSemesterCourse(semester.id, course.id, 'status', e.target.value)}
                        >
                          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                          className="table-select"
                          value={course.category}
                          onChange={(e) => handleUpdateSemesterCourse(semester.id, course.id, 'category', e.target.value)}
                        >
                          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button className="btn-delete-xs" onClick={() => handleDeleteSemesterCourse(semester.id, course.id)}>×</button>
                      </div>
                    ))}
                    <button
                      className="btn-add-course"
                      onClick={() => {
                        setSelectedSemester(semester.id);
                        setIsCourseDialogOpen(true);
                      }}
                    >
                      + Add Course
                    </button>
                  </div>
                </div>
              );
            })}

            {semesters.length === 0 && currentClasses.length === 0 && (
              <p className="empty-message">No semesters planned yet</p>
            )}
          </div>
        )}

        {/* Core Tab */}
        {activeTab === "core" && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Core Curriculum</h3>
              <span className="hint-text">Click category names or credits to edit</span>
            </div>
            {coreCategories.map(cat => {
              const catCourses = getCoreCoursesForCategory(cat.name);
              const completedCredits = catCourses
                .filter(c => {
                  if (c.source === 'class') return true; // Current classes count
                  if (c.source === 'semester') return c.status === "Completed" || c.status === "Transferred";
                  return c.status === "Completed" || c.status === "Transferred";
                })
                .reduce((sum, c) => sum + (c.credit_hours || 0), 0);

              return (
                <div key={cat.id} className={`core-category-block ${completedCredits >= cat.credits ? "complete" : ""}`}>
                  <div className="core-category-header">
                    <span className="core-id">{cat.id}</span>
                    <input
                      className="core-name-input"
                      value={cat.name}
                      onChange={(e) => updateCoreCategory(cat.id, 'name', e.target.value)}
                      placeholder="Category Name"
                    />
                    <div className="core-credits-edit">
                      <span>{completedCredits}/</span>
                      <input
                        type="number"
                        className="core-credits-input"
                        value={cat.credits}
                        onChange={(e) => updateCoreCategory(cat.id, 'credits', e.target.value)}
                      />
                      <span>credits</span>
                    </div>
                  </div>
                  {catCourses.length > 0 ? (
                    <div className="core-courses">
                      {catCourses.map((core, idx) => (
                        <div key={`${core.id}-${idx}`} className="core-course-row">
                          {core.source === 'class' ? (
                            <>
                              <span className="table-text">{core.course_code}</span>
                              <span className="table-text wide">{core.course_name}</span>
                              <span className="table-text small">{core.credit_hours}</span>
                              <span className="status-badge in-progress">Current</span>
                              <span></span>
                            </>
                          ) : core.source === 'semester' ? (
                            <>
                              <span className="table-text">{core.course_code}</span>
                              <span className="table-text wide">{core.course_name}</span>
                              <span className="table-text small">{core.credit_hours}</span>
                              <span className="status-badge">{core.semesterName}</span>
                              <span></span>
                            </>
                          ) : (
                            <>
                              <input
                                className="table-input"
                                value={core.course_code}
                                onChange={(e) => handleUpdateCore(core.id, 'course_code', e.target.value)}
                              />
                              <input
                                className="table-input wide"
                                value={core.course_name}
                                onChange={(e) => handleUpdateCore(core.id, 'course_name', e.target.value)}
                              />
                              <input
                                className="table-input small"
                                type="number"
                                value={core.credit_hours}
                                onChange={(e) => handleUpdateCore(core.id, 'credit_hours', Number(e.target.value))}
                              />
                              <select
                                className="table-select"
                                value={core.status || "Not Started"}
                                onChange={(e) => handleUpdateCore(core.id, 'status', e.target.value)}
                              >
                                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button className="btn-delete-xs" onClick={() => handleDeleteCore(core.id)}>×</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-hint">No courses yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Major Tab */}
        {activeTab === "major" && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Major Requirements</h3>
            </div>
            {getMajorCourses().length === 0 ? (
              <p className="empty-message">No major courses yet</p>
            ) : (
              <div className="courses-table">
                <div className="table-header-5">
                  <span>Code</span>
                  <span>Name</span>
                  <span>Hrs</span>
                  <span>Status</span>
                  <span></span>
                </div>
                {getMajorCourses().map((major, idx) => (
                  <div key={`${major.id}-${idx}`} className="table-row-5">
                    {major.source === 'class' ? (
                      <>
                        <span className="table-text">{major.course_code}</span>
                        <span className="table-text wide">{major.course_name}</span>
                        <span className="table-text small">{major.credit_hours}</span>
                        <span className="status-badge in-progress">Current</span>
                        <span></span>
                      </>
                    ) : major.source === 'semester' ? (
                      <>
                        <span className="table-text">{major.course_code}</span>
                        <span className="table-text wide">{major.course_name}</span>
                        <span className="table-text small">{major.credit_hours}</span>
                        <span className="status-badge">{major.semesterName}</span>
                        <span></span>
                      </>
                    ) : (
                      <>
                        <input
                          className="table-input"
                          value={major.course_code}
                          onChange={(e) => handleUpdateMajor(major.id, 'course_code', e.target.value)}
                        />
                        <input
                          className="table-input wide"
                          value={major.course_name}
                          onChange={(e) => handleUpdateMajor(major.id, 'course_name', e.target.value)}
                        />
                        <input
                          className="table-input small"
                          type="number"
                          value={major.credit_hours}
                          onChange={(e) => handleUpdateMajor(major.id, 'credit_hours', Number(e.target.value))}
                        />
                        <input
                          type="checkbox"
                          checked={major.is_completed || false}
                          onChange={(e) => handleUpdateMajor(major.id, 'is_completed', e.target.checked)}
                          className="checkbox-input"
                        />
                        <button className="btn-delete-xs" onClick={() => handleDeleteMajor(major.id)}>×</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Minor Tab */}
        {activeTab === "minor" && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>{degreeSettings?.minorName || "Minor"} Requirements</h3>
            </div>

            {/* Minor Progress Bar */}
            <div className="minor-progress-section">
              <div className="minor-progress-header">
                <span>Minor Progress</span>
                <span className="minor-progress-text">
                  {minorProgress.completed}/{minorProgress.required} credits
                  {minorProgress.inProgress > 0 && ` (+${minorProgress.inProgress} in progress)`}
                </span>
              </div>
              <div className="progress-bar-container minor">
                <div className="progress-bar-fill teal" style={{ width: `${minorProgress.percentage}%` }}></div>
              </div>
              <span className="progress-percentage teal">{minorProgress.percentage.toFixed(0)}%</span>
            </div>

            {getMinorCourses().length === 0 ? (
              <p className="empty-message">No minor courses yet</p>
            ) : (
              <div className="courses-table">
                <div className="table-header-5">
                  <span>Code</span>
                  <span>Name</span>
                  <span>Hrs</span>
                  <span>Completed</span>
                  <span></span>
                </div>
                {getMinorCourses().map((minor, idx) => (
                  <div key={`${minor.id}-${idx}`} className="table-row-5">
                    {minor.source === 'class' ? (
                      <>
                        <span className="table-text">{minor.course_code}</span>
                        <span className="table-text wide">{minor.course_name}</span>
                        <span className="table-text small">{minor.credit_hours}</span>
                        <span className="status-badge in-progress">Current</span>
                        <span></span>
                      </>
                    ) : minor.source === 'semester' ? (
                      <>
                        <span className="table-text">{minor.course_code}</span>
                        <span className="table-text wide">{minor.course_name}</span>
                        <span className="table-text small">{minor.credit_hours}</span>
                        <span className="status-badge">{minor.semesterName}</span>
                        <span></span>
                      </>
                    ) : (
                      <>
                        <input
                          className="table-input"
                          value={minor.course_code}
                          onChange={(e) => handleUpdateMinor(minor.id, 'course_code', e.target.value)}
                        />
                        <input
                          className="table-input wide"
                          value={minor.course_name}
                          onChange={(e) => handleUpdateMinor(minor.id, 'course_name', e.target.value)}
                        />
                        <input
                          className="table-input small"
                          type="number"
                          value={minor.credit_hours}
                          onChange={(e) => handleUpdateMinor(minor.id, 'credit_hours', Number(e.target.value))}
                        />
                        <input
                          type="checkbox"
                          checked={minor.is_completed || false}
                          onChange={(e) => handleUpdateMinor(minor.id, 'is_completed', e.target.checked)}
                          className="checkbox-input"
                        />
                        <button className="btn-delete-xs" onClick={() => handleDeleteMinor(minor.id)}>×</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Semester Modal */}
      {isSemesterDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsSemesterDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Semester</h2>
            <form onSubmit={handleAddSemester}>
              <div className="form-group">
                <label>Semester Name *</label>
                <input
                  value={semesterData.name}
                  onChange={(e) => setSemesterData({ ...semesterData, name: e.target.value })}
                  placeholder="e.g., Fall 2025"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsSemesterDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Semester</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {isCourseDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsCourseDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Course</h2>
            <form onSubmit={handleAddCourseToSemester}>
              <div className="form-row">
                <div className="form-group">
                  <label>Course Code *</label>
                  <input
                    value={courseData.course_code}
                    onChange={(e) => setCourseData({ ...courseData, course_code: e.target.value })}
                    placeholder="CS 3345"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Credit Hours</label>
                  <input
                    type="number"
                    value={courseData.credit_hours}
                    onChange={(e) => setCourseData({ ...courseData, credit_hours: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Course Name *</label>
                <input
                  value={courseData.course_name}
                  onChange={(e) => setCourseData({ ...courseData, course_name: e.target.value })}
                  placeholder="Data Structures"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={courseData.category}
                    onChange={(e) => setCourseData({ ...courseData, category: e.target.value, core_category: "" })}
                  >
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={courseData.status}
                    onChange={(e) => setCourseData({ ...courseData, status: e.target.value })}
                  >
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {courseData.category === "Core" && (
                <div className="form-group">
                  <label>Core Category *</label>
                  <select
                    value={courseData.core_category}
                    onChange={(e) => setCourseData({ ...courseData, core_category: e.target.value })}
                    required
                  >
                    <option value="">Select Core Category</option>
                    {coreCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.id} {cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsCourseDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Degree Settings</h2>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Minor Name</label>
                <input
                  value={degreeSettings?.minorName || ""}
                  onChange={(e) => setDegreeSettings({ ...degreeSettings, minorName: e.target.value })}
                  placeholder="e.g., Business Administration"
                />
              </div>
              <div className="form-group">
                <label>Minor Credits Required</label>
                <input
                  type="number"
                  value={degreeSettings?.minorCreditsRequired || 18}
                  onChange={(e) => setDegreeSettings({ ...degreeSettings, minorCreditsRequired: Number(e.target.value) })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsSettingsDialogOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDeleteDialogOpen && (
  <div className="modal-overlay" onClick={() => setIsDeleteDialogOpen(false)}>
    <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
      <div className="delete-icon">⚠</div>
      <h3>Delete Semester?</h3>
      <p>Are you sure you want to delete <strong>{semesterToDelete?.name}</strong>?</p>
      <p>This will remove all courses planned for this term.</p>
      <p className="warning-text">This action cannot be undone.</p>
      <div className="dialog-actions">
        <button onClick={() => setIsDeleteDialogOpen(false)} className="cancel-btn">
          Cancel
        </button>
        <button onClick={handleConfirmDeleteSemester} className="confirm-delete-btn">
          Delete
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
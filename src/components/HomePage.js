import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import "../styles/HomePage.css";
import { 
  LayoutDashboard, BookOpen, FileText, Calendar, 
  StickyNote, CheckSquare, Briefcase, GraduationCap, 
  Trophy, Calculator, User , LogOut
} from 'lucide-react';

export default function HomePage() {
  const [user , setUser] = useState(null);
  const [userProfile , setUserProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos] = useState([]);
  const [applications, setApplications] = useState([]);
  const [notes, setNotes] = useState([]);
  const [coreReqs, setCoreReqs] = useState([]);
  const [majorReqs, setMajorReqs] = useState([]);
  const [minorReqs, setMinorReqs] = useState([]);
  const [gradedAssignments, setGradedAssignments] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) setUserProfile(docSnap.data());
    });
    return () => unsub();
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
  const q = query(collection(db, "degreeSemesters"), where("uid", "==", user.uid));
  const unsub = onSnapshot(q, (snapshot) => {
    setSemesters(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsub();
}, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "assignments"), where("uid", "==", user.uid), where("is_completed", "==", false));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAssignments(data.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "todos"), where("uid", "==", user.uid), where("is_completed", "==", false));
    const unsub = onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "applications"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setApplications(data.sort((a, b) => new Date(b.applied_date || 0) - new Date(a.applied_date || 0)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
  if (!user) return;
  const q = query(collection(db, "notes"), where("uid", "==", user.uid));
  const unsub = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    setNotes(data.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    }));
  });
  return () => unsub();
}, [user]);

  useEffect(() => {
    if (!user) return;
    
    const q1 = query(collection(db, "coreRequirements"), where("uid", "==", user.uid));
    const unsub1 = onSnapshot(q1, (snapshot) => {
      setCoreReqs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    
    const q2 = query(collection(db, "majorRequirements"), where("uid", "==", user.uid));
    const unsub2 = onSnapshot(q2, (snapshot) => {
      setMajorReqs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    
    const q3 = query(collection(db, "minorRequirements"), where("uid", "==", user.uid));
    const unsub3 = onSnapshot(q3, (snapshot) => {
      setMinorReqs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "assignments"),
      where("uid", "==", user.uid),
      where("is_completed", "==", true),
      where("is_graded", "==", true)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setGradedAssignments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const getTodayDay = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  };

  const todayClasses = classes.filter(cls => cls.days && cls.days.includes(getTodayDay()));

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Interview": return { bg: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" };
      case "Offer": return { bg: "rgba(16, 185, 129, 0.2)", text: "#34d399" };
      case "Rejected": return { bg: "rgba(239, 68, 68, 0.2)", text: "#f87171" };
      case "Accepted": return { bg: "rgba(34, 197, 94, 0.2)", text: "#4ade80" };
      default: return { bg: "rgba(100, 116, 139, 0.2)", text: "#94a3b8" };
    }
  };


  const calculateDegreeProgress = () => {
  if (!userProfile) return { totalCompleted: 0, totalRequired: 120, percentage: 0 };

  const totalRequired = Number(userProfile.degree_credit_requirement) || 120;
  const completedCourses = new Map(); // Use Map to prevent double counting

  [...coreReqs, ...majorReqs, ...minorReqs].forEach(c => {
    if (c.is_completed === true || c.status === "Completed" || c.status === "Transferred") {
      completedCourses.set(c.course_code, Number(c.credit_hours) || 0);
    }
  });

  semesters.forEach(sem => {
    (sem.courses || []).forEach(c => {
      if (c.status === "Completed" || c.status === "Transferred") {
        completedCourses.set(c.course_code, Number(c.credit_hours) || 0);
      }
    });
  });

  const courseCredits = Array.from(completedCourses.values()).reduce((a, b) => a + b, 0);
  const transferredProfileHours = Number(userProfile.completed_credit_hours) || 0;

  const totalCompleted = courseCredits + transferredProfileHours;
  
  return {
    totalCompleted,
    totalRequired,
    percentage: totalRequired > 0 ? Math.min((totalCompleted / totalRequired) * 100, 100) : 0
  };
};
const getGradePoints = (percentage) => {
    if (percentage >= 93) return 4.0;
    if (percentage >= 90) return 3.67;
    if (percentage >= 87) return 3.33;
    if (percentage >= 83) return 3.0;
    if (percentage >= 80) return 2.67;
    if (percentage >= 77) return 2.33;
    if (percentage >= 73) return 2.0;
    if (percentage >= 70) return 1.67;
    if (percentage >= 67) return 1.33;
    if (percentage >= 63) return 1.0;
    if (percentage >= 60) return 0.67;
    return 0.0;
  };

    const calculateGPA = () => {
    const priorGpa = Number(userProfile?.current_gpa) || 0;
    const priorCredits = Number(userProfile?.completed_credit_hours) || 0;

    let currentPoints = 0;
    let currentCredits = 0;

    classes.forEach(cls => {
      const classAssignments = gradedAssignments.filter(a => a.class_id === cls.id);
      if (classAssignments.length > 0 && cls.credit_hours) {
        const totalPts = classAssignments.reduce((sum, a) => sum + (a.total_points || 0), 0);
        const earnedPts = classAssignments.reduce((sum, a) => sum + (a.earned_points || 0), 0);
        
        if (totalPts > 0) {
          const percentage = (earnedPts / totalPts) * 100;
          const gpaValue = getGradePoints(percentage);
          currentPoints += gpaValue * Number(cls.credit_hours);
          currentCredits += Number(cls.credit_hours);
        }
      }
    });

    const totalPoints = (priorGpa * priorCredits) + currentPoints;
    const totalCredits = priorCredits + currentCredits;

    if (totalCredits === 0) return { gpa: priorGpa > 0 ? priorGpa.toFixed(2) : 0, hasData: priorGpa > 0 };
    
    const finalGpa = totalPoints / totalCredits;
    return { gpa: finalGpa.toFixed(2), hasData: true };
  };

  const degreeProgress = calculateDegreeProgress();
  const gpaData = calculateGPA();

  const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const sortedTodayClasses = todayClasses
  .slice()
  .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));



  const getUserName = () => {
    if (userProfile?.full_name) return userProfile.full_name.split(' ')[0];
    if (user?.displayName) return user.displayName.split(' ')[0];
    return 'Student';
  };

  if (!user) {
    return <div className="empty-state">Please sign in to view dashboard</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome back, {getUserName()}! 👋</h1>
        <p>Here's what's happening today, {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="top-stats">
        <Link to="/GPACalculator" className="stat-card gpa">
          <div ><Calculator size={40} /></div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: gpaData.gpa >= 3.5 ? '#10b981' : gpaData.gpa >= 3.0 ? '#3b82f6' : '#f59e0b' }}>
              {gpaData.hasData ? gpaData.gpa : 'N/A'}
            </span>
            <span className="stat-label">Current GPA</span>
          </div>
        </Link>

        <Link to="/degree-planner" className="stat-card degree">
          <div className="stat-icon-bg"><GraduationCap size={40}/></div>
          <div className="stat-info">
            <span className="stat-value">{degreeProgress.percentage.toFixed(0)}%</span>
            <span className="stat-label">{degreeProgress.totalCompleted} / {degreeProgress.totalRequired} credits</span>
          </div>
          <div className="stat-progress-bar">
            <div className="stat-progress-fill" style={{ width: `${degreeProgress.percentage}%` }}></div>
          </div>
        </Link>

        <Link to="/gradetracker" className="stat-card grades">
          <div className="stat-icon-bg"> <Trophy size={40} /></div>
          <div className="stat-info">
            <span className="stat-value">{gradedAssignments.length}</span>
            <span className="stat-label">Graded Assignments</span>
          </div>
        </Link>
      </div>

      {/* Main Preview Grid */}
      <div className="preview-grid">
        
        {/* Today's Schedule */}
        <Link to="/classes" className="preview-card large">
          <div className="preview-header">
            <div className="preview-title-row">
              <span className="preview-icon"><BookOpen size={20} /></span>
              <h3>Today's Schedule</h3>
            </div>
            <span className="preview-badge blue">{todayClasses.length} classes</span>
          </div>
          <div className="preview-content">
            {todayClasses.length > 0 ? (
              <div className="schedule-list">
               {sortedTodayClasses.slice(0, 3).map(cls => (
                <div key={cls.id} className="schedule-item">
                  <div
                    className="schedule-color"
                    style={{ backgroundColor: cls.color || '#3b82f6' }}
                  ></div>

                  <div className="schedule-info">
                    <span className="schedule-code">{cls.course_code}</span>
                    <span className="schedule-name">{cls.course_name}</span>
                  </div>

                  <div className="schedule-time">
                    <span>{cls.start_time}</span>
                    <span className="schedule-room">{cls.room_number}</span>
                  </div>
                </div>
              ))}

              </div>
            ) : (
              <div className="preview-empty-state">
                <span>🎉</span>
                <p>No classes today!</p>
              </div>
            )}
          </div>
        </Link>

        {/* Assignments */}
        <Link to="/assignments" className="preview-card">
          <div className="preview-header">
            <div className="preview-title-row">
              <span className="preview-icon"><FileText size={20} /> </span>
              <h3>Assignments</h3>
            </div>
            <span className="preview-badge purple">{assignments.length} due</span>
          </div>
          <div className="preview-content">
            {assignments.length > 0 ? (
              <div className="preview-list">
                {assignments.slice(0, 3).map(a => {
                  const cls = classes.find(c => c.id === a.class_id);
                  const dueText = formatDate(a.due_date);
                  return (
                    <div key={a.id} className="preview-item">
                      <div className="preview-item-color" style={{ backgroundColor: cls?.color || '#8b5cf6' }}></div>
                      <div className="preview-item-info">
                        <span className="preview-item-title">{a.title}</span>
                        <span className="preview-item-sub">{cls?.course_code}</span>
                      </div>
                      <span className={`preview-due ${dueText === 'Overdue' ? 'overdue' : dueText === 'Today' ? 'today' : ''}`}>
                        {dueText}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="preview-empty-state small">
                <p>All caught up! ✨</p>
              </div>
            )}
          </div>
        </Link>

        {/* To-Do */}
        <Link to="/todo" className="preview-card">
          <div className="preview-header">
            <div className="preview-title-row">
              <span className="preview-icon"><CheckSquare size={20} /></span>
              <h3>To-Do</h3>
            </div>
            <span className="preview-badge green">{todos.length} tasks</span>
          </div>
          <div className="preview-content">
            {todos.length > 0 ? (
              <div className="preview-list">
                {todos.slice(0, 3).map(todo => (
                  <div key={todo.id} className="preview-item">
                    <div className={`todo-check ${todo.priority?.toLowerCase()}`}></div>
                    <div className="preview-item-info">
                      <span className="preview-item-title">{todo.title}</span>
                    </div>
                    <span className={`preview-priority ${todo.priority?.toLowerCase()}`}>{todo.priority}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="preview-empty-state small">
                <p>No tasks pending</p>
              </div>
            )}
          </div>
        </Link>

        {/* Career */}
        <Link to="/career" className="preview-card">
          <div className="preview-header">
            <div className="preview-title-row">
              <span className="preview-icon"><Briefcase size={20} /></span>
              <h3>Career</h3>
            </div>
            <span className="preview-badge orange">{applications.length} apps</span>
          </div>
          <div className="preview-content">
            {applications.length > 0 ? (
              <div className="preview-list">
                {applications.slice(0, 3).map(app => {
                  const statusColor = getStatusColor(app.status);
                  return (
                    <div key={app.id} className="preview-item">
                      <div className="preview-item-info">
                        <span className="preview-item-title">{app.position}</span>
                        <span className="preview-item-sub">{app.company_organization}</span>
                      </div>
                      <span className="preview-status" style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>
                        {app.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="preview-empty-state small">
                <p>No applications yet</p>
              </div>
            )}
          </div>
        </Link>

        {/* Notes */}
        <Link to="/notes" className="preview-card">
          <div className="preview-header">
            <div className="preview-title-row">
              <span className="preview-icon"><StickyNote size={20} /></span>
              <h3>Notes</h3>
            </div>
            <span className="preview-badge">{notes.length} notes</span>
          </div>
          <div className="preview-content">
            {notes.length > 0 ? (
              <div className="preview-list">
                {notes.slice(0, 3).map(note => {
                  const cls = classes.find(c => c.id === note.class_id);
                  return (
                    <div key={note.id} className="preview-item">
                      <div className="preview-item-color" style={{ backgroundColor: cls?.color || '#64748b' }}></div>
                      <div className="preview-item-info">
                        <span className="preview-item-title">{note.title}</span>
                        <span className="preview-item-sub">{cls?.course_code || 'General'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="preview-empty-state small">
                <p>No notes yet</p>
              </div>
            )}
          </div>
        </Link>

        {/* Calendar */}
        <Link to="/calendar" className="preview-card">
          <div className="preview-header">
            <div className="preview-title-row">
              <span className="preview-icon"><Calendar size={20} /></span>
              <h3>Calendar</h3>
            </div>
          </div>
          <div className="preview-content">
            <div className="calendar-mini">
              <div className="calendar-today">
                <span className="calendar-weekday">{getTodayDay()}</span>
                <span className="calendar-day-num">{new Date().getDate()}</span>
                <span className="calendar-month">{new Date().toLocaleDateString('en-US', { month: 'short' })}</span>
              </div>
              <div className="calendar-right">
                <div className="calendar-summary">
                  <div className="calendar-stat">
                    <span className="cal-num">{todayClasses.length}</span>
                    <span className="cal-label">Classes</span>
                  </div>
                  <div className="calendar-stat">
                    <span className="cal-num">{assignments.filter(a => formatDate(a.due_date) === 'Today').length}</span>
                    <span className="cal-label">Due Today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>

      </div>
    </div>
  );
}

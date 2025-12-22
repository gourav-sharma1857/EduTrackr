import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/GpaCalculator.css";


export default function GpaCalculator() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [allCompletedCourses, setAllCompletedCourses] = useState([]);
  const [completedAssignments, setCompletedAssignments] = useState([]);
  const [categoryWeights, setCategoryWeights] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      if (profileDoc.exists()) setUserProfile(profileDoc.data());
      
      const weightsDoc = await getDoc(doc(db, "categoryWeights", user.uid));
      if (weightsDoc.exists()) setCategoryWeights(weightsDoc.data().weights || {});
    };
    loadData();
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
    const q = query(
      collection(db, "classes"), 
      where("uid", "==", user.uid), 
      where("is_completed", "==", true) 
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setAllCompletedCourses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "assignments"), where("uid", "==", user.uid), where("is_completed", "==", true), where("is_graded", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      setCompletedAssignments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const getLetterGrade = (percentage) => {
    if (percentage >= 97) return { grade: 'A+', gpa: 4.0 };
    if (percentage >= 93) return { grade: 'A', gpa: 4.0 };
    if (percentage >= 90) return { grade: 'A-', gpa: 3.67 };
    if (percentage >= 87) return { grade: 'B+', gpa: 3.33 };
    if (percentage >= 83) return { grade: 'B', gpa: 3.0 };
    if (percentage >= 80) return { grade: 'B-', gpa: 2.67 };
    if (percentage >= 77) return { grade: 'C+', gpa: 2.33 };
    if (percentage >= 73) return { grade: 'C', gpa: 2.0 };
    if (percentage >= 70) return { grade: 'C-', gpa: 1.67 };
    if (percentage >= 67) return { grade: 'D+', gpa: 1.33 };
    if (percentage >= 63) return { grade: 'D', gpa: 1.0 };
    if (percentage >= 60) return { grade: 'D-', gpa: 0.67 };
    return { grade: 'F', gpa: 0.0 };
  };

  const getGradeColor = (gpa) => {
    if (gpa >= 3.5) return '#10b981';
    if (gpa >= 3.0) return '#3b82f6';
    if (gpa >= 2.5) return '#f59e0b';
    if (gpa >= 2.0) return '#f97316';
    return '#ef4444';
  };

  const calculateClassGrade = (classId) => {
    const gradedAssignments = completedAssignments.filter(a => a.class_id === classId);
    if (gradedAssignments.length === 0) return null;

    const categories = {};
    gradedAssignments.forEach(assignment => {
      const cat = assignment.category || 'Other';
      if (!categories[cat]) {
        categories[cat] = { total: 0, earned: 0, weight: categoryWeights[`${classId}_${cat}`] || 0 };
      }
      categories[cat].total += assignment.total_points || 0;
      categories[cat].earned += assignment.earned_points || 0;
    });

    Object.keys(categories).forEach(cat => {
      categories[cat].percentage = categories[cat].total > 0 
        ? (categories[cat].earned / categories[cat].total) * 100 
        : 0;
    });

    const totalWeight = Object.values(categories).reduce((sum, c) => sum + c.weight, 0);
    
    let finalPercentage;
    if (totalWeight > 0 && totalWeight <= 100) {
      finalPercentage = Object.values(categories).reduce((sum, c) => {
        return sum + (c.percentage * (c.weight / 100));
      }, 0);
      finalPercentage = (finalPercentage / totalWeight) * 100;
    } else {
      const totalPoints = gradedAssignments.reduce((sum, a) => sum + (a.total_points || 0), 0);
      const earnedPoints = gradedAssignments.reduce((sum, a) => sum + (a.earned_points || 0), 0);
      finalPercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    }

    return { 
      percentage: finalPercentage, 
      categories, 
      letterGrade: getLetterGrade(finalPercentage),
      assignmentCount: gradedAssignments.length
    };
  };

  const calculateSemesterGPA = () => {
    let totalPoints = 0;
    let totalCredits = 0;

    classes.forEach(cls => {
      const grade = calculateClassGrade(cls.id);
      if (grade && cls.credit_hours && !cls.is_transfer) {
        totalPoints += grade.letterGrade.gpa * cls.credit_hours;
        totalCredits += cls.credit_hours;
      }
    });
    return totalCredits > 0 ? (totalPoints / totalCredits) : 0;
  };

  const calculateCumulativeGPA = () => {
    
    let calculatedPoints = 0;
    let calculatedCredits = 0;

    allCompletedCourses.forEach(course => {
      if (!course.is_transfer) {
        const gpaValue = typeof course.final_gpa === 'number'
          ? course.final_gpa
          : (typeof course.grade === 'number' ? getLetterGrade(course.grade).gpa : null);
        if (gpaValue != null) {
          calculatedPoints += gpaValue * (course.credit_hours || 0);
          calculatedCredits += (course.credit_hours || 0);
        }
      }
    });

    classes.forEach(cls => {
      const grade = calculateClassGrade(cls.id);
      if (grade && !cls.is_transfer) {
        calculatedPoints += (grade.letterGrade.gpa * (cls.credit_hours || 0));
        calculatedCredits += (cls.credit_hours || 0);
      }
    });

    
    
    const priorGpa = userProfile?.current_gpa ?? null;
    const priorCredits = Number(userProfile?.completed_credit_hours || 0);
    
    
    // If user provided prior GPA and there are no calculated credits,
    // return the profile GPA directly (user expects that to take precedence).
    if (priorGpa != null && calculatedCredits === 0) {
      return priorGpa;
    }

    if (priorGpa != null && priorCredits > 0) {
      const priorPoints = priorGpa * priorCredits;
      const totalPoints = priorPoints + calculatedPoints;
      const totalCredits = priorCredits + calculatedCredits;
      return totalCredits > 0 ? (totalPoints / totalCredits) : priorGpa;
    }

    
    // Fallback: calculate from available app data only
    return calculatedCredits > 0 ? (calculatedPoints / calculatedCredits) : (priorGpa != null ? priorGpa : 0);
  };

  const calculateTotalCredits = () => {
    const completed = allCompletedCourses.reduce((sum, c) => sum + (c.credit_hours || 0), 0);
    const current = classes.reduce((sum, c) => sum + (c.credit_hours || 0), 0);
    return completed + current;
  };

  const semesterGPA = calculateSemesterGPA();
  const cumulativeGPA = calculateCumulativeGPA();
  const totalCredits = allCompletedCourses.reduce((sum, cls) => sum + (Number(cls.credit_hours) || 0), 0) + 
                     classes.reduce((sum, cls) => sum + (Number(cls.credit_hours) || 0), 0);

  if (!user) {
    return <div className="empty-state">Please sign in to view GPA calculator</div>;
  }

  return (
    <div className="gpa-container">
      <div className="gpa-header">
        <h1>GPA Calculator</h1>
        <p>Track your academic performance (UTD 4.0 Scale)</p>
      </div>

      
      <div className="gpa-summary">
        <div className="gpa-card main">
          <div className="gpa-card-content">
            <span className="gpa-value" style={{ color: getGradeColor(semesterGPA) }}>
              {semesterGPA.toFixed(2)}
            </span>
            <span className="gpa-label">Semester GPA</span>
            <span className="gpa-sublabel">Based on {completedAssignments.length} graded assignments</span>
          </div>
        </div>

        <div className="gpa-card">
          <div className="gpa-card-content">
            <span className="gpa-value" style={{ color: getGradeColor(cumulativeGPA) }}>
              {cumulativeGPA.toFixed(2)}
            </span>
            <span className="gpa-label">Cumulative GPA</span>
            <span className="gpa-sublabel">Including previous semesters</span>
          </div>
        </div>

        <div className="gpa-card">
          <div className="gpa-card-content">
            <span className="gpa-value">{totalCredits}</span>
            <span className="gpa-label">Total Credits</span>
            <span className="gpa-sublabel">{classes.reduce((sum, cls) => sum + (cls.credit_hours || 0), 0)} current</span>
          </div>
        </div>
      </div>

      
      <div className="gpa-scale">
        <h3>UTD GPA Scale</h3>
        <div className="scale-grid">
          <div className="scale-item"><span className="grade">A+/A</span><span>4.0</span><span>93-100%</span></div>
          <div className="scale-item"><span className="grade">A-</span><span>3.67</span><span>90-92%</span></div>
          <div className="scale-item"><span className="grade">B+</span><span>3.33</span><span>87-89%</span></div>
          <div className="scale-item"><span className="grade">B</span><span>3.0</span><span>83-86%</span></div>
          <div className="scale-item"><span className="grade">B-</span><span>2.67</span><span>80-82%</span></div>
          <div className="scale-item"><span className="grade">C+</span><span>2.33</span><span>77-79%</span></div>
          <div className="scale-item"><span className="grade">C</span><span>2.0</span><span>73-76%</span></div>
          <div className="scale-item"><span className="grade">C-</span><span>1.67</span><span>70-72%</span></div>
          <div className="scale-item"><span className="grade">D+</span><span>1.33</span><span>67-69%</span></div>
          <div className="scale-item"><span className="grade">D</span><span>1.0</span><span>63-66%</span></div>
          <div className="scale-item"><span className="grade">D-</span><span>0.67</span><span>60-62%</span></div>
          <div className="scale-item"><span className="grade">F</span><span>0.0</span><span>&lt;60%</span></div>
        </div>
      </div>

      <div className="classes-breakdown">
        <h2>Class Grade Breakdown</h2>
        {classes.length === 0 ? (
          <div className="empty-card">No active classes. Add classes to calculate GPA.</div>
        ) : (
          <div className="class-cards">
            {classes.map(cls => {
              const gradeInfo = calculateClassGrade(cls.id);
              return (
                <div key={cls.id} className="class-grade-card" style={{ borderLeftColor: cls.color || "#3b82f6" }}>
                  <div className="class-grade-header">
                    <div>
                      <h3>{cls.course_code}</h3>
                      <p>{cls.course_name}</p>
                    </div>
                    {gradeInfo ? (
                      <div className="grade-display" style={{ color: getGradeColor(gradeInfo.letterGrade.gpa) }}>
                        <span className="letter-grade">{gradeInfo.letterGrade.grade}</span>
                        <span className="percentage">{gradeInfo.percentage.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <div className="grade-display no-grade">
                        <span>N/A</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="class-meta">
                    <span>{cls.credit_hours} credits</span>
                    {gradeInfo && <span>{gradeInfo.assignmentCount} graded assignments</span>}
                  </div>

                  {gradeInfo && Object.keys(gradeInfo.categories).length > 0 && (
                    <div className="category-breakdown">
                      <h4>Category Breakdown</h4>
                      {Object.entries(gradeInfo.categories).map(([category, data]) => (
                        <div key={category} className="category-row">
                          <span className="category-name">{category}</span>
                          <div className="category-bar">
                            <div 
                              className="category-fill" 
                              style={{ 
                                width: `${data.percentage}%`,
                                backgroundColor: getGradeColor(getLetterGrade(data.percentage).gpa)
                              }}
                            ></div>
                          </div>
                          <span className="category-percent">{data.percentage.toFixed(1)}%</span>
                          <span className="category-points">{data.earned}/{data.total}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!gradeInfo && (
                    <p className="no-grades-message">No graded assignments yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
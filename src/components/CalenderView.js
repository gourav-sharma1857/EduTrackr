import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/CalenderView.css";

export default function CalenderView() {
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q1 = query(collection(db, "assignments"), where("uid", "==", user.uid), where("is_completed", "==", false));
    const unsub1 = onSnapshot(q1, (snapshot) => {
      setAssignments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const q2 = query(collection(db, "todos"), where("uid", "==", user.uid), where("is_completed", "==", false));
    const unsub2 = onSnapshot(q2, (snapshot) => {
      setTodos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const q3 = query(collection(db, "classes"), where("uid", "==", user.uid), where("is_active", "==", true));
    const unsub3 = onSnapshot(q3, (snapshot) => {
      setClasses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const q4 = query(collection(db, "applications"), where("uid", "==", user.uid));
    const unsub4 = onSnapshot(q4, (snapshot) => {
      setApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4();};
  }, [user]);
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  };

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const getEventsForDay = (date) => {
    const events = [];
    
    assignments.forEach(assignment => {
      if (assignment.due_date && isSameDay(new Date(assignment.due_date), date)) {
        const cls = classes.find(c => c.id === assignment.class_id);
        events.push({
          type: 'assignment',
          title: assignment.title,
          color: cls?.color || '#8b5cf6',
          className: cls?.course_code,
          dueDate: assignment.due_date,
          id: assignment.id,
          time: new Date(assignment.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        });
      }
    });

    todos.forEach(todo => {
      if (todo.due_date && isSameDay(new Date(todo.due_date), date)) {
        events.push({
          type: 'todo',
          title: todo.title,
          color: '#10b981',
          dueDate: todo.due_date,
          id: todo.id,
          time: new Date(todo.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        });
      }
    });

    applications.forEach(app => {
      if (app.interview_date && isSameDay(new Date(app.interview_date), date)) {
        events.push({
          type: 'interview',
          title: `${app.company_organization} - ${app.position}`,
          color: '#f59e0b',
          dueDate: app.interview_date,
          id: app.id,
          time: app.interview_time || ''
        });
      }
    });

    return events;
  };

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const goToToday = () => setCurrentDate(new Date());

  const days = getDaysInMonth(currentDate);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (!user) return <div className="empty-state">Please sign in to view calendar</div>;

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="nav-btn" onClick={previousMonth}>◀</button>
          <h1>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h1>
          <button className="nav-btn" onClick={nextMonth}>▶</button>
        </div>
        <button className="btn-today" onClick={goToToday}>Today</button>
      </div>

      <div className="calendar-grid">
        {dayNames.map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}

        {days.map((dayInfo, index) => {
          const events = getEventsForDay(dayInfo.date);
          const isToday = isSameDay(dayInfo.date, new Date());
          
          return (
            <div 
              key={index} 
              className={`calendar-day ${!dayInfo.currentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
            >
              <span className="day-number">{dayInfo.day}</span>
              <div className="day-events">
                {events.slice(0, 3).map((event, idx) => (
                  <div 
                    key={idx} 
                    className={`event-item ${event.type}`}
                    style={{ backgroundColor: event.color + '30', borderLeftColor: event.color }}
                  >
                    <div className="event-content">
                      <span className="event-title">{event.title}</span>
                      {event.time && <span className="event-time">{event.time}</span>}
                    </div>
                    
                  </div>
                ))}
                {events.length > 3 && (
                  <span className="more-events">+{events.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="calendar-legends">
        <div className="legend-section">
          <h3>Event Types</h3>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#10b981' }}></span>
              <span>To-Do Items</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
              <span>Interviews</span>
            </div>
          </div>
        </div>
        <div className="legend-section">
          <h3>Class Colors (Assignments)</h3>
          <div className="legend-items">
            {classes.length > 0 ? (
              classes.map(cls => (
                <div key={cls.id} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: cls.color || '#3b82f6' }}></span>
                  <span>{cls.course_code} - {cls.course_name}</span>
                </div>
              ))
            ) : (
              <span className="legend-empty">No classes added yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Reminder Modal */}
    </div>
  );
}
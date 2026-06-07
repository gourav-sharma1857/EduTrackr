import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom"; // Essential for rendering over layout containers
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { Bell, Search, Mail, Heart, MessageSquare, X } from "lucide-react";
import "../styles/Topbar.css";

export default function Topbar() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [time, setTime] = useState(new Date());
  const [assignments, setAssignments] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false); 
  const dropRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (s) => {
      if (s.exists()) setProfile(s.data());
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "assignments"),
      where("uid", "==", user.uid),
      where("is_completed", "==", false)
    );
    const unsub = onSnapshot(q, (s) =>
      setAssignments(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const now = new Date();
  const overdue = assignments.filter((a) => a.due_date && new Date(a.due_date) < now);
  const todayDue = assignments.filter((a) => {
    if (!a.due_date) return false;
    const d = new Date(a.due_date);
    return d.toDateString() === now.toDateString() && d >= now;
  });
  const urgentCount = overdue.length + todayDue.length;

  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const getName = () => {
    const n = profile?.display_name || user?.displayName || "Student";
    return n.split(" ")[0];
  };

  const getInitials = () => {
    const n = profile?.display_name || user?.displayName || "S";
    return n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <header className="topbar">
      <div className="topbar-greeting">
        <span className="greeting-hi">{greeting()},</span>
        <span className="greeting-name">{getName()}</span>
        {profile?.major && <span className="greeting-major">· {profile.major}</span>}
      </div>

      <div className="topbar-right">
        {/* Support Trigger Button */}
        <button className="tb-support-btn" onClick={() => setShowSupportModal(true)}>
          <MessageSquare size={16} />
          <span>Support & Feedback</span>
        </button>

        <div className="topbar-clock">
          <span className="clock-time">
            {time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true , second:"2-digit"})}
          </span>
          <span className="clock-date">
            {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>

        {/* Notifications */}
        <div className="notif-wrap" ref={dropRef}>
          <button
            className={`notif-btn ${urgentCount > 0 ? "urgent" : ""}`}
            onClick={() => setShowNotifs((v) => !v)}
          >
            <Bell size={17} />
            {urgentCount > 0 && <span className="notif-dot">{urgentCount}</span>}
          </button>

          {showNotifs && (
            <div className="notif-panel">
              <div className="notif-panel-header">
                <span>Notifications</span>
                {urgentCount > 0 && <span className="np-count">{urgentCount} urgent</span>}
              </div>

              {overdue.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group-label overdue">⚠ Overdue</div>
                  {overdue.slice(0, 4).map((a) => (
                    <div key={a.id} className="notif-row overdue-row">
                      <div className="notif-row-left">
                        <span className="notif-row-dot" />
                        <span className="notif-row-title">{a.title}</span>
                      </div>
                      <span className="notif-row-date">
                        {new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {todayDue.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group-label today">📅 Due Today</div>
                  {todayDue.slice(0, 4).map((a) => (
                    <div key={a.id} className="notif-row today-row">
                      <div className="notif-row-left">
                        <span className="notif-row-dot" />
                        <span className="notif-row-title">{a.title}</span>
                      </div>
                      <span className="notif-row-date">
                        {new Date(a.due_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {urgentCount === 0 && (
                <div className="notif-empty">✨ All caught up!</div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="topbar-avatar" title={getName()}>
          {getInitials()}
        </div>
      </div>

      {/* Rendered via React Portal directly into document.body */}
      {showSupportModal && createPortal(
        <div className="tb-modal-overlay" onClick={() => setShowSupportModal(false)}>
          <div className="tb-modal-card" onClick={(e) => e.stopPropagation()}>
            
            <button className="tb-modal-close" onClick={() => setShowSupportModal(false)}>
              <X size={18} />
            </button>

            <div className="tb-modal-header">
              <div className="tb-modal-icon-badge">🎓</div>
              <h3>Student Built App 👋</h3>
            </div>

            <div className="tb-modal-body">
              <p>
                Thanks for using <strong>EduTrackr</strong>! This is a personal project 
                built entirely by me as a student. I am trying to improve it day by day.
              </p>
              <p>
                If you find this app helpful, or have any issues or feature ideas, please 
                reach out! I am happy to help resolve issues and hear your thoughts.
              </p>
            </div>

            <div className="tb-modal-footer">
              <a href="mailto:your.email@example.com?subject=EduTrackr%20Feedback" className="tb-email-link">
                <Mail size={16} />
                <span>Email Me</span>
              </a>
              <div className="tb-student-made">
                Made with <Heart size={12} className="heart-icon" /> by a student
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import "../styles/Sidebar.css";

const menuItems = [
  { label: "Dashboard", path: "/", icon: "📊" },
  { label: "Classes", path: "/classes", icon: "📚" },
  { label: "Assignments", path: "/assignments", icon: "📝" },
  { label: "Calendar", path: "/calendar", icon: "📅" },
  { label: "Notes", path: "/notes", icon: "📔" },
  { label: "To-Do List", path: "/todo", icon: "✅" },
  { label: "Career", path: "/career", icon: "💼" },
  { label: "Degree Planner", path: "/degree-planner", icon: "🎓" },
  { label: "Grade Tracker", path: "/gradetracker", icon: "🏆" },
  { label: "GPA Calculator", path: "/gpacalculator", icon: "🧮" },
  { label: "Profile", path: "/profile", icon: "👤" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem("sidebar.collapsed");
      return v === "true";
    } catch (e) {
      return false;
    }
  });

  const [hovering, setHovering] = useState(false);

  const showLabels = !collapsed || hovering;

  const toggle = (e) => {
    e.stopPropagation(); 
    setCollapsed((s) => {
      const next = !s;
      try {
        localStorage.setItem("sidebar.collapsed", String(next));
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    if (collapsed) document.body.classList.add("sb-collapsed");
    else document.body.classList.remove("sb-collapsed");
  }, [collapsed]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      <div
        className={`sidebar ${collapsed ? "collapsed" : ""} ${hovering ? "hovering" : ""}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">🎓</span>
            {showLabels && <span className="logo-text">EduTrackr</span>}
          </div>
          <button
            className="toggle-btn"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => navigate(item.path)}
              title={!showLabels ? item.label : ""} 
            >
              <span className="nav-icon">{item.icon}</span>
              {showLabels && <span className="nav-label">{item.label}</span>}
              {isActive(item.path) && <div className="active-indicator"></div>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout} title={!showLabels ? "Logout" : ""}>
            <span className="nav-icon">🚪</span>
            {showLabels && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mobile-backdrop" onClick={() => setCollapsed(true)} />
      )}
      
      <button
        className={`mobile-menu-btn ${collapsed ? "visible" : ""}`}
        onClick={() => setCollapsed(false)}
        aria-label="Open menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </>
  );
}
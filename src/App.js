import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AuthPage from "./components/AuthPage";
import Classes from "./components/Classes";
import Assignments from "./components/Assignments";
import CalendarView from "./components/CalenderView"; 
import Career from "./components/Career";
import GpaCalculator from "./components/GpaCalculator"; 
import GradeTracker from "./components/GradeTracker";
import Notes from "./components/Notes";
import ToDoList from "./components/ToDoList"; 
import Profile from "./components/Profile";
import DegreePlanner from "./components/DegreePlanner";
import "./App.css";
import HomePage from "./components/HomePage";

function ProtectedLayout({ title, children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Trackly ...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title={title} />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );

  
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading EduTrackr...</p>
      </div>
    );
  }

  return (
    <Routes>
      
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <AuthPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedLayout title="HomePage">
            <HomePage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/home"
        element={
          <ProtectedLayout title="HomePage">
            <HomePage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/classes"
        element={
          <ProtectedLayout title="Classes">
            <Classes />
          </ProtectedLayout>
        }
      />

      <Route
        path="/assignments"
        element={
          <ProtectedLayout title="Assignments">
            <Assignments />
          </ProtectedLayout>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedLayout title="Calendar">
            <CalendarView />
          </ProtectedLayout>
        }
      />

      <Route
        path="/notes"
        element={
          <ProtectedLayout title="Notes">
            <Notes />
          </ProtectedLayout>
        }
      />

      <Route
        path="/todo"
        element={
          <ProtectedLayout title="To-Do List">
            <ToDoList />
          </ProtectedLayout>
        }
      />

      <Route
        path="/career"
        element={
          <ProtectedLayout title="Career">
            <Career />
          </ProtectedLayout>
        }
      />

      <Route
        path="/degree-planner"
        element={
          <ProtectedLayout title="Degree Planner">
            <DegreePlanner />
          </ProtectedLayout>
        }
      />

      <Route
        path="/gradetracker"
        element={
          <ProtectedLayout title="Grade Tracker">
            <GradeTracker />
          </ProtectedLayout>
        }
      />

      <Route
        path="/GPACalculator"
        element={
          <ProtectedLayout title="GPA Calculator">
            <GpaCalculator />
          </ProtectedLayout>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedLayout title="Profile">
            <Profile />
          </ProtectedLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
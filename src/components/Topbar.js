import React , { useState , useEffect} from "react";
import {auth} from "../firebase";
import { onAuthStateChanged} from "firebase/auth";
import "../styles/Topbar.css"

export default function Topbar({ title }) {
  const [user , setUser] = useState(null);
  const [currentTime , setCurrentTime] = useState(new Date());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth , (currentUser) =>{
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second:"2-digit",
      hour12: true,
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

   const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="topbar">
      <div className="topbar-right">
        <div className="datetime-display">
          <div className="time-display">{formatTime(currentTime)}</div>
          <div className="date-display">{formatDate(currentTime)}</div>
        </div>
      </div>
    </div>
  );

}
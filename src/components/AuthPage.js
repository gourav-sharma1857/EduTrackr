import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import Confetti from "react-confetti";
import { useNavigate } from "react-router-dom";
import "../styles/AuthPage.css";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [userCaptcha, setUserCaptcha] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorLink, setErrorLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const googleProvider = new GoogleAuthProvider();

  const generateCaptcha = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const captchaLength = 6;
    let result = '';
    for (let i = 0; i < captchaLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    setCaptcha(result);
  };

  useEffect(() => generateCaptcha(), []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      await signInWithPopup(auth, googleProvider);
      setShowConfetti(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      console.error('Google auth error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in popup was closed. Please try again.');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMessage('Popup was blocked. Please allow popups for this site.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setErrorMessage('Sign-in was cancelled. Please try again.');
      } else if (err?.code === 'auth/operation-not-allowed') {
        setErrorMessage('Google sign-in is not enabled. Enable it in Firebase Console.');
        setErrorLink('https://console.firebase.google.com/project/_/authentication/providers');
      } else {
        setErrorMessage(err?.message || 'Google sign-in failed. Please try again.');
      }
    }
    setIsLoading(false);
  };

  

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    if (userCaptcha !== captcha) {
      setErrorMessage("Captcha does not match!");
      setIsLoading(false);
      return;
    }

    if (!isLogin && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters for signup.');
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setShowConfetti(true);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setShowConfetti(true);
      }
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (err) {
      console.error('Auth error:', err);
      if (err?.code === 'auth/operation-not-allowed') {
        const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'your-project-id';
        const consoleLink = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
        setErrorMessage('Email/Password sign-in is disabled for this Firebase project.');
        setErrorLink(consoleLink);
      } else if (err?.code === 'auth/user-not-found') {
        setErrorMessage('No account found with this email. Please sign up.');
      } else if (err?.code === 'auth/wrong-password') {
        setErrorMessage('Incorrect password. Please try again.');
      } else if (err?.code === 'auth/email-already-in-use') {
        setErrorMessage('This email is already registered. Please login.');
      } else if (err?.code === 'auth/invalid-email') {
        setErrorMessage('Invalid email address.');
      } else if (err?.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Use at least 6 characters.');
      } else {
        const msg = err?.message || (isLogin ? 'Login failed.' : 'Signup failed.');
        setErrorMessage(msg);
        setErrorLink("");
      }
      generateCaptcha();
    }
    setIsLoading(false);
  };
  const handleForgotPassword = async () => {
  setErrorMessage("");
  setErrorLink("");

  if (!email) {
    setErrorMessage("Please enter your email to reset your password.");
    return;
  }

  try {
    setIsLoading(true);
    await sendPasswordResetEmail(auth, email);
    setErrorMessage("Password reset email sent. Check your inbox or Spam Folder");
  } catch (err) {
    console.error("Reset password error:", err);

    if (err?.code === "auth/user-not-found") {
      setErrorMessage("No account found with this email.");
    } else if (err?.code === "auth/invalid-email") {
      setErrorMessage("Invalid email address.");
    } else {
      setErrorMessage("Failed to send reset email. Try again.");
    }
  } finally {
    setIsLoading(false);
  }
};
  return (
    <div className="auth-container">
      {showConfetti && <Confetti />}
      <div className="auth-box">
        <div className={`auth-inner ${isLogin ? "" : "flip"}`}>
          {/* Login Side */}
          <div className="auth-front">
            <h1 className="title">Login</h1>
            
            {/* Google Sign-In Button */}
            <button 
              type="button" 
              className="google-btn"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="animated-input"
                />
              </div>
              <div className="input-group">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="animated-input"
                />
              </div>
              <div className="captcha-container">
                <span className="captcha">{captcha}</span>
                <button
                  type="button"
                  onClick={generateCaptcha}
                  className="refresh-btn"
                >
                  ↻
                </button>
              </div>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Enter Captcha"
                  value={userCaptcha}
                  onChange={(e) => setUserCaptcha(e.target.value)}
                  required
                  className="animated-input"
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Please wait..." : "Login"}
              </button>
              {errorMessage && <p className="error-msg">{errorMessage}</p>}
              {errorLink && (
                <p className="error-msg">
                  <a href__={errorLink} target="_blank" rel="noreferrer" style={{color:'#bfdbfe'}}>Enable it in Firebase Console</a>
                </p>
              )}
            </form>
            <p className="toggle-text" onClick={() => setIsLogin(false)}>
              Don't have an account? Sign Up
            </p>
              <p
                className="forgot-password"
                onClick={handleForgotPassword}
                style={{
                  marginTop: "10px",
                  cursor: "pointer",
                  color: "#93c5fd",
                  textAlign: "right",
                  fontSize: "0.9rem"
                }}
              >
                Forgot password? Bruh!!
              </p>
          </div>

          {/* SignUp Side */}
          <div className="auth-back">
            <h1 className="title">Sign Up</h1>
            
            {/* Google Sign-In Button */}
            <button 
              type="button" 
              className="google-btn"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="animated-input"
                />
              </div>
              <div className="input-group">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="animated-input"
                />
              </div>
              <div className="captcha-container">
                <span className="captcha">{captcha}</span>
                <button
                  type="button"
                  onClick={generateCaptcha}
                  className="refresh-btn"
                >
                  ↻
                </button>
              </div>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Enter Captcha"
                  value={userCaptcha}
                  onChange={(e) => setUserCaptcha(e.target.value)}
                  required
                  className="animated-input"
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Please wait..." : "Sign Up"}
              </button>
              {<p className="error-msg">{errorMessage}</p>}
            </form>
            <p className="toggle-text" onClick={() => setIsLogin(true)}>
              Already have an account? Login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
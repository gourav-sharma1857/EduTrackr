# EduTrackr

EduTrackr is a student-centered productivity and academic planning web application built with React and Firebase.

---

## Application Structure and Coding Overview

EduTrackr is a modular, component-driven React application with Firebase handling authentication and data persistence. The codebase emphasizes separation of concerns, reusable components, and real-time data synchronization.

## Routing and Navigation

- React Router with HashRouter for client-side routing
- One route per major page component
- Authentication-protected routes for core features
- Persistent Sidebar and Topbar for navigation

## State Management

- React hooks including useState and useEffect
- Authentication state tracked through Firebase listeners
- Localized state scoped to individual pages

## Firebase Integration

- Firebase Authentication for user sessions
- Cloud Firestore as the primary database
- User-scoped data using unique uid values
- Real-time updates via Firestore listeners

## Component Design

- Self-contained page components
- Reusable shared UI components
- Page-level data fetching and rendering logic

## Styling Approach

- Plain CSS with component-level style files
- Styles organized under src/styles
- Responsive layouts for multiple screen sizes

## Data Flow Pattern

Authentication -> User Profile -> Page Data

markdown
Copy code

- Firestore queries run after authentication
- UI updates on Firestore data changes

## Pages and Views Overview

### Authentication
- Dedicated authentication page
- Email and Password and Google sign-in
- Client-side validation

### Dashboard
- Aggregated overview of academic data
- Lightweight preview queries
- Optimized initial load

### Classes
- Course management interface
- Shared reference for assignments and grades
- Schedule and visual metadata

### Assignments
- User and class-filtered assignments
- Completion and grading tracking
- Integrated with grade data

### Grade Tracker
- Class-based grade aggregation
- Firestore-driven grade data
- Supports GPA calculations

### GPA Calculator
- Client-side GPA computation
- Automatic recalculation on updates
- No server-side logic

### Degree Planner
- Semester-based course planning
- Credit and status tracking
- Long-term degree visualization

### Notes
- General and class-linked notes
- Firestore text storage
- Fast create and edit flow

### To-Do List
- Task tracking with priorities
- Simple completion workflow
- Lightweight data model

### Calendar
- Time-based academic visualization
- Uses existing assignment and class data
- No duplicated storage

### Career Applications
- Job and internship tracking
- Status-based organization
- Easily extendable structure

### Profile
- User academic overview
- Credit and progress summaries
- Centralized profile data

## Getting Started

### Requirements

- Node.js version 14 or higher
- npm
- Firebase project with Authentication and Firestore enabled

### Installation

git clone https://github.com/gourav-sharma1857/EduTrackr.git
cd EduTrackr
npm install
Environment Variables
Create a .env file in the project root:

env
Copy code
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
Firebase Setup
Firebase Console

Authentication

Sign-in Method

Enable Google and Email and Password providers

Run Locally
bash
Copy code
npm start
Open http://localhost:3000. HashRouter is used for routing.

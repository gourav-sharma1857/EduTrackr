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
- Repeated assignments: Allows for the creation of recurring tasks, such as weekly reflections or daily practice logs, without manual duplication.

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

Prerequisites:
- Node.js (>= 14) and npm

Install and run locally:

```powershell
cd dashboard
npm install
npm start
```

Open `http://localhost:3000` (or the port shown) in your browser.

## Firebase Configuration

This app expects environment variables to be set in a `.env` file placed in the main directory. Create a `.env` with the following keys (replace values with your Firebase project's values):

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

Important:
- After creating/updating `.env`, restart the dev server (`npm start`) so CRA picks up the changes.
- In Firebase Console enable **Authentication -> Sign-in method -> Google** and **Firestore** (in test or appropriate rules for development).

## File Overview

## Deploying to GitHub Pages

This project can be published to GitHub Pages using the `gh-pages` package. The repository owner is `gourav-sharma1857` and the repo is `EduTrackr`, so the app will be available at:

```
https://gourav-sharma1857.github.io/EduTrackr
```

Steps to publish:

1. Ensure the `homepage` field in `dashboard/package.json` is set to the URL above (already configured).
2. Install the deploy tool (local dev dependency):

```powershell
cd dashboard
npm install --save-dev gh-pages
```

3. Build and deploy:

```powershell
cd dashboard
npm run deploy
```

Notes:
- The `deploy` script runs `npm run build` and then publishes the `build` folder to a `gh-pages` branch.
- If you host from a custom domain or username page, adjust the `homepage` field accordingly.


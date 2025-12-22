# Getting Started with Create React App

##Application Structure & Coding Overview

EduTrackr is built as a modular, component-driven React application with Firebase handling authentication and data persistence. The codebase emphasizes separation of concerns, reusable components, and real-time data updates.

##Routing & Navigation

Uses React Router (HashRouter) for client-side routing

Each major page is mapped to its own route and component

Protected routes ensure authenticated access to core pages

Sidebar and Topbar persist across pages for consistent navigation

##State Management

Relies on React hooks (useState, useEffect) for local state

User authentication state is tracked globally through Firebase listeners

Page-specific state is isolated within individual components

##Firebase Integration

Firebase Authentication manages user sessions and sign-in methods

Cloud Firestore is used as the primary database

Data is scoped per user using their unique uid

Real-time listeners (onSnapshot) keep UI in sync with database changes

##Component Design

Each page is implemented as a self-contained React component

Shared UI elements (Sidebar, Topbar, Modals, Cards) are reused across pages

Logic for data fetching and rendering is colocated within the page components for clarity

##Styling Approach

Uses plain CSS with component-specific style files

Styles are organized under src/styles/ and mapped to components

Layouts are responsive and optimized for desktop and smaller screens

##Data Flow Pattern

Authentication → fetch user profile → load page-specific data

Firestore queries are triggered after authentication is confirmed

UI updates automatically when Firestore data changes

##Pages & Views Overview (with Code Context)

Authentication Page

Implemented as a standalone component

Uses Firebase Auth methods for sign-in and account creation

Handles form validation and basic client-side checks
-------------------------------------------------------------------

Home / Dashboard

Aggregates data from multiple Firestore collections

Uses lightweight queries to show previews rather than full datasets

Designed for fast initial load and minimal user interaction
-------------------------------------------------------------------

Classes Page

CRUD-based page for managing course data

Course entries are reused by assignments, notes, and grades

Color-coding and schedule data are stored per class

------------------------------------------------------------------
Assignments Page

Queries assignments filtered by user and class

Supports updates to completion and grading state

Connects directly with the grade tracking system
-------------------------------------------------------------------

Grade Tracker Page

Reads graded assignment data from Firestore

Groups data by class for display

Serves as the data source for GPA calculations

-------------------------------------------------------------------
GPA Calculator

Performs client-side calculations using stored grade data

Automatically recalculates when grades or credit hours change

No server-side computation required
------------------------------------------------------------------

Degree Planner

Uses structured Firestore documents to represent semesters

Tracks credit accumulation and course status

Designed to support future export/import features

-------------------------------------------------------------------
Notes Page

Supports both general notes and class-linked notes

Text content is stored directly in Firestore

Designed for quick creation and editing

------------------------------------------------------------------
To-Do List

Simple task-based Firestore collection

Uses priority flags for UI emphasis

Focuses on fast add/edit/complete actions
------------------------------------------------------------------

Calendar View

Transforms existing class and assignment data into a time-based layout

Acts as a visual layer on top of existing Firestore data

No duplicate data storage

--------------------------------------------------------------------
Career / Applications Page

Structured around application status tracking

Designed to be easily extendable with additional fields

Keeps career data separate from academic data

----------------------------------------------------------------------
Profile Page

Reads from the user document in Firestore

Displays summary-level academic progress

Centralizes user-specific metadata
-----------------------------------------------------------------------

## Getting started (local development) 
Requirements - Node.js (v14+ recommended) and npm - A Firebase project with Firestore and Authentication enabled 
1. Clone the repo git clone https://github.com/gourav-sharma1857/EduTrackr.git cd EduTrackr
2.  Install dependencies npm install
3.  Create a .env file in the project root (same level as package.json)
   and add Firebase config values:
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
 5. Enable Authentication providers - In Firebase Console → Authentication → Sign-in method - Enable Google provider (for "Continue with Google") - Enable Email/Password provider (for email sign-up/login) - If Email/Password sign-in is disabled you'll see an error in the app and a link to the Firebase console will be suggested.
 6.  Start the dev server npm start Open http://localhost:3000 (HashRouter is used; pages route by hash)
7.   Build for production npm run build
8.    Run tests (CRA default) npm test

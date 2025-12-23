EduTrackr

EduTrackr is a student-centered productivity and academic planning web application built with React and Firebase.

Application Structure and Coding Overview

EduTrackr is a modular, component-driven React application with Firebase handling authentication and data persistence. The codebase emphasizes separation of concerns, reusable components, and real-time data synchronization.

Routing and Navigation

Uses React Router with HashRouter for client-side routing

Each major page is mapped to its own route and component

Protected routes restrict access to authenticated users

Sidebar and Topbar persist across pages for consistent navigation

State Management

Built using React hooks such as useState and useEffect

Authentication state is tracked using Firebase listeners

Page-specific state is scoped locally within individual components

Firebase Integration

Firebase Authentication manages user sessions and sign-in

Cloud Firestore serves as the primary database

Data is scoped per user using a unique uid

Real-time listeners keep the UI synchronized with Firestore data

Component Design

Each page is implemented as a self-contained React component

Shared UI elements such as Sidebar, Topbar, modals, and cards are reused

Data fetching and rendering logic are colocated within page components

Styling Approach

Uses plain CSS with component-specific style files

Styles are organized under src/styles

Layouts are responsive and optimized for different screen sizes

Data Flow Pattern
Authentication -> Fetch User Profile -> Load Page-Specific Data


Firestore queries execute only after authentication is confirmed

UI updates automatically when Firestore data changes

Pages and Views Overview
Authentication Page

Standalone authentication component

Supports Email and Password as well as Google sign-in

Handles basic form validation and client-side checks

Home and Dashboard

Aggregates data from multiple Firestore collections

Uses lightweight queries to display quick previews

Optimized for fast initial load

Classes Page

Manages course creation and updates

Classes act as shared references for assignments, notes, and grades

Stores schedule and visual identifiers

Assignments Page

Displays assignments filtered by user and class

Tracks completion and grading status

Feeds data into the grade tracking system

Grade Tracker Page

Reads graded assignment data from Firestore

Groups academic performance by class

Serves as the basis for GPA calculations

GPA Calculator

Performs client-side GPA calculations

Automatically recalculates when grade data changes

Does not rely on server-side computation

Degree Planner

Organizes courses by semester

Tracks credit progress and course status

Designed for long-term academic planning

Notes Page

Supports general notes and class-linked notes

Stores text-based content in Firestore

Allows quick creation and editing

To-Do List

Manages task-based reminders

Supports priority levels

Focuses on fast task updates

Calendar View

Presents academic data in a time-based layout

Uses existing class and assignment data

Avoids duplicate data storage

Career and Applications Page

Tracks job and internship applications

Organizes data by application status

Structured for easy extension

Profile Page

Displays user-specific academic information

Shows summary-level progress

Centralizes profile data

Getting Started with Create React App
Requirements

Node.js version 14 or higher

npm

Firebase project with Authentication and Firestore enabled

Installation
git clone https://github.com/gourav-sharma1857/EduTrackr.git
cd EduTrackr
npm install

Environment Setup

Create a .env file in the project root and add the following:

REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

Enable Firebase Authentication

Open Firebase Console

Navigate to Authentication then Sign-in Method

Enable Google and Email or Password providers

Run the Application
npm start


Open http://localhost:3000. HashRouter is used for routing.

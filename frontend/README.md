# BrandTech Frontend

This folder contains the React + Vite frontend for the BrandTech secure document access portal.

The frontend is responsible for the visual experience: login/register screens, admin dashboard, customer dashboard, route redirects, forms, modals, and local UI state. Trusted data changes go through the Express backend.

## Stack

- React
- Vite
- JavaScript / JSX
- React Router
- Firebase client SDK for Authentication session state
- Express API calls through `src/services/apiClient.js`
- Lucide React icons
- Tailwind CSS utility classes

## Current Architecture

```text
React frontend
  -> Firebase Auth client session
  -> Express API with bearer token
  -> Firebase Admin SDK on backend
  -> Firestore / Storage / Auth
```

React protects screens for user experience, but Express enforces backend permissions. For example, `/admin` redirects non-admin users in React, while backend admin routes also require a verified Firebase token and an active admin profile.

## Environment Variables

Create `frontend/.env` with Firebase web config plus the backend URL:

```env
VITE_API_URL=http://localhost:3000

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Important Files

```text
src/App.jsx
```

Defines routes and route protection:

- `/login`
- `/register`
- `/admin`
- `/dashboard`

```text
src/context/AuthContext.jsx
```

Keeps track of the signed-in Firebase user, loads the Firestore profile, blocks pending/denied/revoked/unverified customers, and exposes `login`, `register`, and `logout`.

```text
src/services/apiClient.js
```

The bridge from React to Express. It reads the Firebase ID token from the current user and sends it as:

```text
Authorization: Bearer <firebase-id-token>
```

Every backend service function builds on this file.

```text
src/services/
```

Service files keep backend calls out of the page components:

- `auditService.js`: loads audit-log rows.
- `documentService.js`: uploads, edits, deletes, lists, previews, and downloads documents.
- `notificationService.js`: listens to notifications and marks/dismisses them.
- `registrationService.js`: creates customer profiles through Express after Firebase Auth registration.
- `requestService.js`: creates and reviews document access requests.
- `userService.js`: loads, approves, denies, and revokes customer accounts.

They are `.js` files because they are plain JavaScript helper modules, not React components. Components use `.jsx` because they return JSX markup.

## Pages

```text
src/pages/Login.jsx
```

Signs users in and redirects by role.

```text
src/pages/Register.jsx
```

Creates customer accounts. It validates phone number length by country, requires browser location, creates the Firebase Auth user, sends email verification, and asks Express to create the pending customer profile.

```text
src/pages/AdminDashboard.jsx
```

Admin portal:

- Dashboard metrics
- Document upload/edit/delete
- Target documents to all customers, a company, or one customer
- Access request approve/deny/grant/revoke
- User approve/deny/revoke with required messages
- Registration location review
- Audit log including customer downloads
- Settings/profile UI

```text
src/pages/CustomerDashboard.jsx
```

Customer portal:

- View assigned documents
- Request document access
- Open/download approved documents
- View request history
- Read or dismiss notifications
- View read-only account identity fields

## Components

```text
src/components/DocumentPreviewModal.jsx
```

Shows in-app previews for images and PDFs. Office documents are downloaded because Google Docs preview can refuse embedded private URLs.

## Firebase Reference Files

```text
src/firebase/securityRules.txt
src/firebase/storageRules.txt
```

These are local reference copies. Firebase only uses them after you paste and publish them in the Firebase Console.

## Running With Backend

Run backend first:

```bash
cd ../backend
npm run dev
```

Run frontend second:

```bash
cd ../frontend
npm run dev
```

Open `http://localhost:5173`. The browser console should show the API health-check message if Express is reachable.

## Full Handoff Guide

For the complete architecture, Firebase transfer checklist, collection schemas, route map, and troubleshooting notes, read:

```text
../TECHNICAL_DOCUMENTATION.md
```

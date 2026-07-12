# BrandTech Frontend

This folder contains the React + Vite frontend for the BrandTech secure document access portal.

The frontend is responsible for the visual experience: login/register screens, admin dashboard, customer dashboard, route redirects, forms, modals, folder views, and local UI state. Trusted data changes go through the Express backend.

## Stack

- React 19
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

React protects screens for user experience, but Express enforces backend permissions. For example, `/admin` redirects non-admin users in React, while backend admin routes also require a verified Firebase token and an active admin or owner profile.

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
VITE_MEASUREMENT_ID=your_measurement_id
```

For production builds, `VITE_API_URL` should point to the deployed Cloud Run backend. In GitHub Actions, these values should be provided through repository secrets because Vite reads them at build time.

## Scripts

```bash
npm install
npm run dev      # local development
npm run build    # production build into dist/
npm run lint     # lint check
npm run preview  # preview built frontend locally
```

## Important Files

### `src/main.jsx`

Mounts the React app into the root DOM element.

### `src/App.jsx`

Defines routes and route protection:

- `/login`
- `/register`
- `/admin`
- `/dashboard`

`ProtectedRoute` redirects users away from pages they should not see. The backend still protects the actual data.

### `src/context/AuthContext.jsx`

Keeps track of the signed-in Firebase user, loads the user profile through Express, blocks pending/denied/revoked/unverified customers, and exposes `user`, `loading`, `login`, `register`, and `logout` through `useAuth()`.

### `src/services/apiClient.js`

The bridge from React to Express. It reads the Firebase ID token from the current user and sends it as:

```text
Authorization: Bearer <firebase-id-token>
```

Every backend service function builds on this file.

### `src/services/`

Service files keep backend calls out of page components:

- `auditService.js`: loads read-only audit-log rows.
- `documentService.js`: uploads, edits, deletes, lists, previews, downloads documents, creates folders, updates folders, and uploads folders/subfolders.
- `notificationService.js`: loads notifications and marks/dismisses them.
- `registrationService.js`: creates customer profiles through Express after Firebase Auth registration.
- `requestService.js`: creates customer access requests, reviews admin decisions, revokes access, and updates folder-level document exclusions.
- `userService.js`: loads, approves, denies, revokes customers, and handles owner-only admin role changes.

They are `.js` files because they are plain JavaScript helper modules, not React components. Components use `.jsx` because they return JSX markup.

## Pages

### `src/pages/Login.jsx`

Signs users in and redirects by role.

### `src/pages/Register.jsx`

Creates customer accounts. It validates phone number length by country, requires browser location, creates the Firebase Auth user, sends email verification, and asks Express to create the pending customer profile.

### `src/pages/AdminDashboard.jsx`

Admin portal:

- Dashboard metrics
- Document upload/edit/delete
- Folder and subfolder creation
- Folder upload with selectable sharing tree
- File destination selection for uploads and edits
- Target audience options: admins only, all active customers, specific company, or specific customer
- Access Requests tab for pending customer requests
- Access Management tab for approved access and revocation
- Folder access management with per-document unshare exclusions
- User approval/denial/revocation with required messages
- Owner-only All Users tab for making/revoking admins
- Registration location review
- Read-only audit log including uploads, access actions, and downloads
- Settings/profile UI

### `src/pages/CustomerDashboard.jsx`

Customer portal:

- View folders and subfolders assigned to their account/company
- Request folder or document access
- Open/download approved documents
- View request history
- Read or dismiss notifications
- View read-only account identity fields

Customers can see folder structure for assigned folders, but documents only become downloadable after approved access.

## Components

### `src/components/DocumentPreviewModal.jsx`

Shows in-app previews where supported and provides download actions. Office documents generally download instead of being embedded because private signed URLs do not always work inside third-party preview frames.

## Target Audience Behavior

Admin forms can target content to:

- `admin`: admins only
- `all`: all active customers
- `company`: one approved company
- `customer`: one active customer

Admin-only content stays available in the admin dashboard but is not visible/requestable in the customer dashboard.

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

## Deployment

The frontend is deployed to Firebase Hosting. A typical production build uses:

```bash
npm run build
firebase deploy --only hosting
```

If using GitHub Actions, store Vite environment values as repository secrets so the production build can connect to the correct Firebase project and Cloud Run API.

## Firebase Reference Files

```text
src/firebase/securityRules.txt
src/firebase/storageRules.txt
```

These are local reference copies. Firebase only uses them after you paste and publish them in the Firebase Console.

## Full Handoff Guide

For the complete architecture, Firebase transfer checklist, collection schemas, route map, and troubleshooting notes, read:

```text
../TECHNICAL_DOCUMENTATION.md
```

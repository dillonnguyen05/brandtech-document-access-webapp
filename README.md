# BrandTech Document Access Webapp

BrandTech Document Access Webapp is a secure document portal with two experiences:

- Admin portal: upload documents, target documents to customers/companies, approve users, approve or deny document requests, revoke access, and review audit history.
- Customer portal: register with email verification and location capture, request access to assigned documents, receive notifications, and download approved documents.

## Architecture

```text
React + Vite frontend
  -> Express API
    -> Firebase Admin SDK
      -> Firebase Auth
      -> Cloud Firestore
      -> Firebase Storage
```

React owns the user interface and route redirects. Express owns trusted backend workflows such as role checks, document upload, signed download URLs, account decisions, request decisions, notifications, and audit logging. Firebase stores authentication accounts, Firestore records, and uploaded files.

## Project Structure

```text
backend/
  src/
    middleware/        Firebase token and role/status checks
    routes/            Express route modules by feature
    firebaseAdmin.js   Firebase Admin SDK setup
    server.js          Express app configuration
frontend/
  src/
    components/        Reusable UI components
    context/           AuthContext and user session state
    firebase/          Firebase web config and rule reference files
    pages/             Login, register, admin, and customer screens
    services/          Frontend API/service wrappers
```

## Main Workflows

- Registration: React creates the Firebase Auth account, requests browser location, then Express creates a pending Firestore customer profile.
- Admin user approval: Express checks the admin role, verifies the customer email and registration location, updates the customer status, creates a notification, and writes an audit log.
- Document upload: React sends `FormData` to Express. Express validates the file, uploads it to Firebase Storage, saves Firestore metadata, and records the upload.
- Access request: Customers request access through Express. Admins approve, deny, grant, or revoke access with optional/required messages.
- Download: React asks Express for a short-lived signed URL. Customer downloads are written to the audit log.

## Local Setup

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Run the backend in one terminal:

```bash
cd backend
npm run dev
```

Run the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Environment Files

Frontend uses `frontend/.env` for Firebase web config and API URL.

Backend uses `backend/.env` for the Express port, frontend origin, Firebase Storage bucket, and the Firebase Admin service-account path.

Never commit real `.env` files or Firebase Admin service-account JSON files.

## Firebase Rules

Reference copies live in:

- `frontend/src/firebase/securityRules.txt`
- `frontend/src/firebase/storageRules.txt`

Paste/publish those rules in the Firebase Console when they change. Local `.txt` files are documentation only until published.

## More Documentation

- Frontend details: `frontend/README.md`
- Backend details: `backend/README.md`

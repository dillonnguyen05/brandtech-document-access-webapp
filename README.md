# BrandTech Document Access Webapp

BrandTech Document Access Webapp is a secure document portal for BrandSafway project documents. It has two main experiences:

- Admin portal: upload documents and folders, create subfolders, target content to admins, all customers, companies, or individual customers, approve users, manage access requests, revoke access, manage admin roles, and review audit history.
- Customer portal: register with email verification and location capture, request access to assigned documents/folders, receive notifications, and download approved documents.

## Architecture

```text
React + Vite frontend
  -> Express API
    -> Firebase Admin SDK
      -> Firebase Auth
      -> Cloud Firestore
      -> Firebase Storage
```

React owns the user interface and route redirects. Express owns trusted backend workflows such as role checks, document upload, folder access changes, signed download URLs, account decisions, request decisions, notifications, and audit logging. Firebase stores authentication accounts, Firestore records, and uploaded files.

## Hosting

- Firebase Hosting serves the React frontend as static production files.
- Google Cloud Run hosts the Express backend because it needs to run Node.js server code and Firebase Admin SDK operations.
- GitHub Actions can build/deploy the frontend to Firebase Hosting on push/merge.
- Cloud Run can be manually deployed or connected to Cloud Build for backend CI/CD.

This split keeps the frontend fast and simple while keeping privileged backend logic on the server.

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

- Registration: React creates the Firebase Auth account, requests browser location, sends email verification, then Express creates a pending Firestore customer profile.
- Admin user approval: Express checks the admin/owner role, verifies customer email/location, updates customer status, creates a notification, and writes an audit row.
- Owner role management: the owner can view all users and promote/revoke admin access. The owner role itself is assigned manually in Firestore.
- Document/folder upload: React sends `FormData` to Express. Express validates files, uploads to Firebase Storage, saves Firestore metadata, creates folder/subfolder records, and writes audit rows.
- Target audience: content can target admins only, all active customers, one company, or one customer.
- Access requests: customers request documents or folders. Admins approve/deny pending requests in Access Requests.
- Access management: admins manage already-approved access separately, including revoking full access or unsharing specific nested documents from an approved folder request.
- Download: React asks Express for a short-lived signed URL. Customer downloads are written to the read-only audit log.
- Audit log: audit history is display-only. Current access changes happen from Access Management instead of directly from Audit Log.

## Local Setup

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
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
- Backend health check: `http://localhost:3000/api/health`

## Environment Files

Frontend uses `frontend/.env` for Firebase web config and API URL.

```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_MEASUREMENT_ID=...
```

Backend uses `backend/.env` for Express and Firebase Admin configuration.

```env
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-adminsdk.json
```

Never commit real `.env` files or Firebase Admin service-account JSON files. For GitHub Actions, use repository secrets. For Cloud Run, use Cloud Run environment variables and service-account permissions.

## Firebase Rules

Reference copies live in:

- `frontend/src/firebase/securityRules.txt`
- `frontend/src/firebase/storageRules.txt`

Paste/publish those rules in the Firebase Console when they change. Local `.txt` files are documentation only until published.

## More Documentation

- Frontend details: `frontend/README.md`
- Backend details: `backend/README.md`

# BrandTech Backend

This folder contains the Express API for the BrandTech document portal.

The backend is the trusted middleware layer between React and Firebase. React can show buttons and pages, but Express verifies identity, checks roles, validates inputs, writes audit records, creates notifications, uploads files, and generates short-lived signed download URLs.

## Stack

- Node.js
- Express
- Firebase Admin SDK
- Firebase Auth token verification
- Cloud Firestore
- Firebase Storage
- Multer for file uploads
- CORS for local frontend access
- Dotenv for local environment variables

## Request Lifecycle

```text
React service function
  -> apiClient fetch/upload
  -> Authorization: Bearer <Firebase ID token>
  -> Express server
  -> verifyFirebaseToken middleware
  -> role/status middleware
  -> route handler
  -> Firebase Admin SDK
  -> JSON response back to React
```

## Environment Variables

Create `backend/.env`:

```env
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-adminsdk.json
```

On Windows, the credentials path will look more like:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\yourname\Downloads\firebase-adminsdk.json
```

Do not commit `.env` or service-account JSON files.

## Scripts

```bash
npm install
npm run dev
npm start
```

`npm run dev` uses `node --watch`, so the server restarts when files change.

## Important Files

```text
src/server.js
```

Configures Express, CORS, JSON parsing, request logging, health check, route mounting, 404 responses, error handling, and server startup.

```text
src/firebaseAdmin.js
```

Initializes the Firebase Admin SDK using local environment credentials. Exports shared Admin Auth, Firestore, and Storage clients.

## Middleware

```text
src/middleware/verifyFirebaseToken.js
```

Reads the bearer token from the request, verifies it with Firebase Admin Auth, and attaches decoded auth data to `req.auth`.

```text
src/middleware/requireAdmin.js
```

Loads the current Firestore user profile and only allows users with `role: "admin"` and `status: "active"`.

```text
src/middleware/requireActiveUser.js
```

Loads the current profile and blocks inactive, pending, denied, revoked, or missing users.

```text
src/middleware/requireCustomer.js
```

Allows only active customer profiles through customer-only routes.

## Routes

```text
src/routes/registration.js
```

Creates pending customer profiles after Firebase Auth registration. Requires full name, company, phone, and browser geolocation.

```text
src/routes/adminUsers.js
```

Admin user management:

- List pending customers
- Sync email verification state from Firebase Auth
- Approve customers
- Deny customers with a message
- Revoke active customers with a message
- Write notifications and audit-log entries

```text
src/routes/documents.js
```

Document management and access:

- Admin upload to Firebase Storage
- Admin edit/delete document metadata
- Target documents to all customers, a company, or one customer
- List documents visible to the current user
- Generate short-lived signed preview/download URLs
- Log customer downloads in the audit log

```text
src/routes/accessRequests.js
```

Document access workflow:

- Customers request document access
- Admins approve or deny pending requests
- Admins grant access again after denial/revocation
- Admins revoke approved access with a message
- Notifications and audit rows are created with each decision

```text
src/routes/notifications.js
```

Notification actions:

- Mark all visible notifications as read
- Mark one notification as read
- Dismiss one notification

```text
src/routes/auditLog.js
```

Returns audit records for the admin dashboard.

## Why Express Is Safer Than Frontend-Only Firebase Calls

React code runs in the browser, so users can inspect or modify client-side behavior. Express runs on the server, so it can safely use the Firebase Admin SDK and enforce trusted checks:

- Verify Firebase ID tokens server-side.
- Re-read the user's role and status from Firestore.
- Block admin routes unless the user is an active admin.
- Validate document targets and account decisions.
- Require denial/revocation messages.
- Generate short-lived signed URLs instead of storing public download links.
- Write audit logs for sensitive actions.

Firebase Security Rules still matter, but Express centralizes complex business logic and keeps privileged Admin SDK operations off the client.

## Manual Health Check

With the backend running:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{"status":"ok","service":"brandtech-api"}
```

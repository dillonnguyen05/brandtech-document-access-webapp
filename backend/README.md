# BrandTech Backend

This folder contains the Express API for the BrandTech document portal.

The backend is the trusted middleware layer between React and Firebase. React can show buttons and pages, but Express verifies identity, checks roles, validates inputs, writes audit records, creates notifications, uploads files, updates folder access rules, and generates short-lived signed download URLs.

## Stack

- Node.js 22+
- Express
- Firebase Admin SDK
- Firebase Auth token verification
- Cloud Firestore
- Firebase Storage
- Multer for file and folder uploads
- CORS for frontend access
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

Create `backend/.env` for local development:

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

On Google Cloud Run, these values are configured as Cloud Run environment variables. Cloud Run should use a service account with the needed Firebase/Google Cloud permissions, including Firestore access, Firebase Auth Admin access, Storage object access, and signed URL permissions.

## Scripts

```bash
npm install
npm run dev   # local development with node --watch
npm start     # normal server start
```

## Important Files

### `src/server.js`

Configures Express, CORS, JSON parsing, request logging, health check, route mounting, 404 responses, error handling, and server startup.

### `src/firebaseAdmin.js`

Initializes the Firebase Admin SDK using local environment credentials or Cloud Run service-account identity. Exports shared Admin Auth, Firestore, and Storage clients.

## Middleware

### `src/middleware/verifyFirebaseToken.js`

Reads the bearer token from the request, verifies it with Firebase Admin Auth, and attaches decoded auth data to `req.auth`.

### `src/middleware/requireAdmin.js`

Loads the current Firestore user profile and only allows users with `role: "admin"` or `role: "owner"` and `status: "active"`.

### `src/middleware/requireActiveUser.js`

Loads the current profile and blocks inactive, pending, denied, revoked, or missing users.

### `src/middleware/requireCustomer.js`

Allows only active customer profiles through customer-only routes.

## Routes

### `src/routes/registration.js`

Creates pending customer profiles after Firebase Auth registration. Requires full name, company, phone, and browser geolocation.

### `src/routes/adminUsers.js`

Admin and owner user management:

- List pending customers
- List active customers
- Sync email verification state from Firebase Auth
- Approve customers after email/location verification
- Deny customers with a message
- Revoke active customers with a message
- Owner-only list of all users
- Owner-only make admin / revoke admin actions
- Write notifications and audit-log entries

The owner role is not self-service. Assign exactly one owner manually in Firestore.

### `src/routes/documents.js`

Document, folder, Storage, and download workflow:

- Admin upload to Firebase Storage
- Admin folder upload with nested folders/subfolders
- Create and update document folder metadata
- Edit/delete document metadata
- Target documents/folders to admins only, all active customers, one company, or one customer
- Store admin-only content with `targetType: "admin"`
- List documents/folders visible to the current user
- Generate short-lived signed preview/download URLs
- Log customer downloads in the audit log
- Enforce folder access exclusions so unshared nested documents cannot be listed or downloaded

### `src/routes/accessRequests.js`

Document and folder access workflow:

- Customers request document access
- Customers request folder/subfolder access
- Admins approve or deny pending requests
- Admins grant access again after denial/revocation
- Admins revoke approved access with a message
- Admins update approved folder access exclusions with `PATCH /api/admin/access-requests/:requestId/exclusions`
- Notifications and audit rows are created with each decision/change

Folder access is stored as one approved folder request. If an admin unshares specific documents inside that folder, the request stores `excludedDocumentIds`. Customer document listing and download checks respect that list.

### `src/routes/notifications.js`

Notification actions:

- List current user's notifications
- Mark all visible notifications as read
- Mark one notification as read
- Dismiss one notification

### `src/routes/auditLog.js`

Returns audit records for the admin dashboard. The frontend treats Audit Log as read-only history. Current access changes are handled in Access Management.

## Target Audience Values

The document API accepts these target values:

- `admin`: admin/owner only, hidden from customers
- `all`: all active customers
- `company`: one company with active customers
- `customer`: one active customer

Customer routes only match `all`, `company`, and `customer`. Admin-only content is not requestable by customers.

## Why Express Is Safer Than Frontend-Only Firebase Calls

React code runs in the browser, so users can inspect or modify client-side behavior. Express runs on the server, so it can safely use the Firebase Admin SDK and enforce trusted checks:

- Verify Firebase ID tokens server-side.
- Re-read the user's role and status from Firestore.
- Block admin routes unless the user is an active admin or owner.
- Validate document targets and account decisions.
- Require denial/revocation messages.
- Validate folder access exclusions before saving them.
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

## Deployment Notes

The backend can be deployed to Google Cloud Run. Cloud Run must have:

- `CLIENT_ORIGIN` set to the Firebase Hosting URL
- `FIREBASE_STORAGE_BUCKET` set to the Firebase Storage bucket
- A service account with Firestore, Firebase Auth Admin, Storage, and signed URL permissions

After deploying Cloud Run, update the frontend production `VITE_API_URL` to the Cloud Run service URL and rebuild/redeploy the frontend.

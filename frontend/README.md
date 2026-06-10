# BrandTech Document Access Portal Frontend

This frontend is a React + Vite application for the BrandTech secure document access portal. It provides separate admin and customer experiences, uses Firebase for authentication, database storage, and file storage, and keeps Firebase logic separated into service files.

## Current Architecture

The current application is frontend-first:

```text
React / Vite frontend
  -> Firebase Auth
  -> Cloud Firestore
  -> Firebase Storage
  -> Firebase Security Rules
```

React handles the UI, routing, form interactions, dashboards, and local page state. Firebase acts as the backend for this proof of concept.

In a future production version, Node.js and Express.js can be added as middleware:

```text
React frontend
  -> Node.js / Express API
  -> Firebase Admin SDK
  -> Firestore / Auth / Storage
```

That backend would be useful for protected admin workflows, audit logging, custom claims, email notifications, secure signed download links, and server-side validation.

## Tech Stack

- React
- Vite
- JavaScript / JSX
- React Router
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Lucide React icons
- Tailwind CSS utility classes

## Install And Run

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Environment Variables

Create a `.env` file in the `frontend` folder with Firebase web app values:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

These values are loaded in `src/firebase/firebaseConfig.js`.

## Firebase Setup

Enable these Firebase products:

- Authentication
- Cloud Firestore
- Firebase Storage

In Authentication:

- Enable email/password sign-in.
- Customers register from the app.
- Admin accounts should be created manually or internally.

In Firestore:

- Paste the rules from `src/firebase/securityRules.txt` into Firebase Console > Firestore Database > Rules.

In Storage:

- Paste the rules from `src/firebase/storageRules.txt` into Firebase Console > Storage > Rules.

The local rules files are documentation copies only. Firebase will not use them until they are pasted and published in the Firebase Console.

## Project Structure

```text
src/
  App.jsx
  main.jsx
  context/
    AuthContext.jsx
  firebase/
    firebaseConfig.js
    securityRules.txt
    storageRules.txt
  services/
    documentService.js
    notificationService.js
    requestService.js
    userService.js
  components/
    DocumentPreviewModal.jsx
  pages/
    Login.jsx
    Register.jsx
    AdminDashboard.jsx
    CustomerDashboard.jsx
  imports/
    brandtech.jpg
    brandsafway-logo.png
```

## Routing

Routing is handled in `src/App.jsx`.

- `/login` shows the login page.
- `/register` shows the customer registration page.
- `/admin` is protected and only allows users with `role: "admin"`.
- `/dashboard` is protected and only allows users with `role: "customer"`.
- `/` redirects signed-in users based on role.
- Unknown routes redirect to `/login`.

`ProtectedRoute` checks the current user from `AuthContext`.

## Authentication And User State

`src/context/AuthContext.jsx` manages auth state.

Main responsibilities:

- Watches Firebase Auth with `onAuthStateChanged`.
- Loads the matching Firestore user profile from `users/{uid}`.
- Blocks customer login if email is not verified.
- Blocks customer login if account status is `pending`, `denied`, or `disabled`.
- Provides `login`, `register`, and `logout`.

Customer registration creates:

```text
users/{uid}
  name
  email
  company
  phone
  role: "customer"
  status: "pending"
  emailVerified: false
  createdAt
```

After registration, Firebase sends an email verification message and signs the customer out. The customer must verify email and wait for admin approval before entering the portal.

## Admin Dashboard

`src/pages/AdminDashboard.jsx` contains the admin portal UI.

Admin sections:

- Dashboard
- Documents
- Access Requests
- User Approvals
- Audit Log
- Settings
- Profile

Admin capabilities:

- View dashboard metrics.
- Upload documents to Firebase Storage.
- Save document metadata in Firestore.
- Target documents to all active customers, one company, or one customer.
- View uploaded document records.
- Preview or download uploaded documents.
- Review customer document access requests.
- Approve or deny document access requests.
- Approve or deny pending customer accounts.
- Create customer notifications when accounts or requests are approved or denied.

The audit log no longer uses mock data. It currently records admin approve/deny actions in local state during the current browser session. To persist audit logs after refresh, add a Firestore-backed `auditService.js`.

## Customer Dashboard

`src/pages/CustomerDashboard.jsx` contains the customer portal UI.

Customer sections:

- Dashboard
- Documents
- Requests
- Notifications
- Profile
- Settings

Customer capabilities:

- View documents that target their account or company.
- Request access to available documents.
- Track pending, approved, and denied requests.
- Open or download approved documents.
- View Firestore notifications.
- Mark notifications as read.
- View profile details.

Customer profile identity fields are read-only:

- Name
- Email
- Company
- Role

The profile page tells customers to contact BrandTech for changes.

## Service Files

### `documentService.js`

Handles document upload and document loading.

Main functions:

- `uploadDocument(file, documentData, user, onProgress)`
- `listenToDocuments(onDocuments, onError)`

Upload flow:

```text
validate file
create safe storage path
upload with uploadBytesResumable
report upload progress
get download URL
save metadata in Firestore documents collection
```

### `requestService.js`

Handles document access requests.

Main functions:

- `createAccessRequest(user, document)`
- `listenToAccessRequests(onRequests, onError)`
- `listenToCustomerRequests(userId, onRequests, onError)`
- `updateAccessRequestStatus(requestId, status, adminUser)`

Access request IDs use:

```text
{customerUserId}_{documentId}
```

This prevents duplicate requests for the same customer and document.

### `notificationService.js`

Handles customer notifications.

Main functions:

- `listenToUserNotifications(userId, onNotifications, onError)`
- `createAccessDecisionNotification(request, status)`
- `createAccountApprovalNotification(customer)`
- `markNotificationsRead(notifications)`

Notifications are created when:

- An admin approves a customer account.
- An admin approves a document access request.
- An admin denies a document access request.

### `userService.js`

Loads active customer accounts for admin document targeting.

Main function:

- `listenToActiveCustomers(onCustomers, onError)`

The admin upload form uses active customers and approved companies to populate targeting options.

## Firestore Collections

### `users`

Stores user profile information.

Important fields:

```text
name
email
company
phone
role
status
emailVerified
createdAt
approvedAt
approvedBy
deniedAt
deniedBy
```

### `documents`

Stores metadata for files uploaded to Firebase Storage.

Important fields:

```text
title
type
category
targetType
targetCustomer
targetCompany
targetCustomerId
targetCustomerName
targetCustomerEmail
fileName
fileSize
fileType
storagePath
downloadURL
uploadedBy
uploadedByName
uploadedByEmail
active
createdAt
```

### `accessRequests`

Stores customer requests to access documents.

Important fields:

```text
customerId
customerName
customerEmail
company
documentId
documentTitle
documentCategory
status
createdAt
reviewedAt
reviewedBy
reviewedByName
```

### `notifications`

Stores customer notification records.

Important fields:

```text
recipientId
recipientName
recipientEmail
type
message
documentId
documentTitle
requestId
read
readAt
createdAt
```

### `auditLog`

Reserved for persistent audit logging. The UI exists, but the current audit entries are local session state.

## Document Targeting Rules

Admin uploads can target:

- All active customers
- A specific company
- A specific customer

Customer visibility is filtered in `CustomerDashboard.jsx`:

- `targetType: "all"` shows to all active customers.
- `targetType: "company"` shows to customers whose `company` matches.
- `targetType: "customer"` shows only to the matching `targetCustomerId`.

Approved document access is still controlled by `accessRequests`. A customer can see requestable documents, but downloads/open access are shown after approval.

## Notifications Flow

Account approval:

```text
Admin approves pending customer
users/{uid}.status becomes "active"
notifications/{uid}_account-approved is created
Customer logs in and sees account approval notification
```

Document request approval:

```text
Customer requests access
accessRequests/{customerId_documentId} is created
Admin approves or denies
notification is created for customer
Customer sees notification and updated request status
```

## Demo Script

Suggested demo order:

1. Register a new customer.
2. Show that the customer account is pending approval.
3. Log in as admin.
4. Open User Approvals and approve the customer.
5. Upload a document from the admin Documents page.
6. Target the document to all customers, a company, or a specific customer.
7. Log in as the customer.
8. Show the account approval notification.
9. Request access to the uploaded document.
10. Log back in as admin.
11. Approve or deny the access request.
12. Log back in as customer.
13. Show the request notification.
14. If approved, open/download the document.

## Admin Settings Notes

The Review Window setting means:

```text
How many days a request can stay pending before it should be flagged for escalation.
```

Example:

- Review window is 7 days.
- Customer submits a request on June 1.
- No admin reviews it by June 8.
- The request should be marked as needing escalation.

Currently this setting is UI-only. In a future backend, it could trigger alerts, emails, dashboard warnings, or manager escalation.

## Known Limitations

- Audit log entries are not persisted after refresh.
- Admin settings are currently local UI state.
- Browser preview support depends on file type. PDFs and images can preview more naturally than Word documents.
- Download URLs are stored in Firestore. For production, consider short-lived signed links from a backend.
- Admin account creation is manual/internal.
- Role changes and custom claims are not yet handled by a Node/Express backend.

## Recommended Future Backend Work

Add Node.js and Express.js when the project moves beyond proof of concept.

Recommended middleware:

```text
verifyFirebaseToken
requireActiveUser
requireAdmin
```

Recommended backend routes:

```text
POST /api/admin/users/:id/approve
POST /api/admin/users/:id/deny
POST /api/admin/access-requests/:id/approve
POST /api/admin/access-requests/:id/deny
POST /api/admin/documents
GET  /api/admin/audit-log
```

The backend should use Firebase Admin SDK to:

- Verify ID tokens.
- Set custom claims.
- Approve or deny users.
- Approve or deny requests.
- Create notifications.
- Write audit logs.
- Generate secure download links.
- Send email notifications.

## Troubleshooting

If registration fails with missing permissions:

- Confirm Firestore rules from `src/firebase/securityRules.txt` are published.
- Confirm Authentication email/password provider is enabled.

If upload fails with `storage/unauthorized`:

- Confirm Storage rules from `src/firebase/storageRules.txt` are published.
- Confirm the signed-in user is an active admin.

If approving a user works but notification creation fails:

- Confirm the `notifications` rules block is published in Firestore rules.

If the app is blank:

- Open browser dev tools.
- Check for missing Firebase env variables.
- Confirm `.env` is in the `frontend` folder.
- Restart the Vite dev server after changing `.env`.

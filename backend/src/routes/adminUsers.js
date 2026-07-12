import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../firebaseAdmin.js";

const router = express.Router();
const OWNER_ROLE = "owner";

/**
 * Creates route errors with HTTP status codes for the shared Express error handler.
 */
function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Converts Firestore Timestamp values into ISO strings for React.
 */
function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

/**
 * Safely converts optional numeric fields like latitude and accuracy.
 */
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * Shapes stored browser-location data for the admin approval table.
 */
function formatRegistrationLocation(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  return {
    latitude: toFiniteNumber(location.latitude),
    longitude: toFiniteNumber(location.longitude),
    accuracy: toFiniteNumber(location.accuracy),
    capturedAt: timestampToIso(location.capturedAt),
    ipAddress: location.ipAddress || "",
    userAgent: location.userAgent || "",
    source: location.source || "browser-geolocation"
  };
}

/**
 * Confirms that a customer registered with usable location coordinates.
 */
function hasRegistrationLocation(location) {
  return toFiniteNumber(location?.latitude) !== null
    && toFiniteNumber(location?.longitude) !== null
    && toFiniteNumber(location?.accuracy) !== null;
}

/**
 * Validates the admin's denial or revocation message before saving it.
 */
function requireDecisionMessage(value) {
  const message = typeof value === "string" ? value.trim() : "";

  if (!message) {
    throw createRouteError(400, "A message explaining this decision is required.");
  }

  if (message.length > 500) {
    throw createRouteError(400, "The decision message must be 500 characters or fewer.");
  }

  return message;
}

/**
 * Combines Firestore profile data with Firebase Auth verification data.
 */
function formatCustomerSnapshot(customerSnapshot, authUser) {
  const data = customerSnapshot.data();

  return {
    id: customerSnapshot.id,
    ...data,
    email: authUser?.email || data.email || "",
    emailVerified: authUser?.emailVerified === true,
    registrationLocation: formatRegistrationLocation(data.registrationLocation),
    createdAt: timestampToIso(data.createdAt),
    approvedAt: timestampToIso(data.approvedAt),
    deniedAt: timestampToIso(data.deniedAt)
  };
}

/**
 * Shapes any user profile for the owner-only role management table.
 */
function formatUserSnapshot(userSnapshot, authUser) {
  const data = userSnapshot.data();

  return {
    id: userSnapshot.id,
    ...data,
    email: authUser?.email || data.email || "",
    emailVerified: authUser?.emailVerified === true,
    disabled: authUser?.disabled === true,
    role: data.role || "customer",
    status: data.status || "unknown",
    registrationLocation: formatRegistrationLocation(data.registrationLocation),
    createdAt: timestampToIso(data.createdAt),
    approvedAt: timestampToIso(data.approvedAt),
    deniedAt: timestampToIso(data.deniedAt),
    revokedAt: timestampToIso(data.revokedAt),
    roleUpdatedAt: timestampToIso(data.roleUpdatedAt)
  };
}

/**
 * Blocks role-management actions unless the signed-in admin is the owner.
 */
function requireOwnerAccess(req) {
  if (req.userProfile?.role !== OWNER_ROLE || req.userProfile?.status !== "active") {
    throw createRouteError(403, "Owner access is required.");
  }
}

/**
 * Loads Firebase Auth users in batches because the Admin SDK caps getUsers calls.
 */
async function loadAuthUsers(userIds) {
  const authUsers = new Map();

  for (let index = 0; index < userIds.length; index += 100) {
    const identifiers = userIds
      .slice(index, index + 100)
      .map((uid) => ({ uid }));
    const result = await adminAuth.getUsers(identifiers);

    result.users.forEach((authUser) => {
      authUsers.set(authUser.uid, authUser);
    });
  }

  return authUsers;
}

/**
 * Normalizes the current admin identity for audit records.
 */
function adminIdentity(req) {
  return {
    id: req.auth.uid,
    name: req.userProfile.name || req.auth.email || "Admin",
    email: req.auth.email || req.userProfile.email || ""
  };
}

/**
 * Approves or denies a pending customer, then creates a notification and audit entry.
 */
async function reviewPendingCustomer(req, status) {
  const { userId } = req.params;
  const admin = adminIdentity(req);
  const userRef = adminDb.collection("users").doc(userId);
  const notificationRef = adminDb
    .collection("notifications")
    .doc(`${userId}_account-${status}`);
  const auditRef = adminDb.collection("auditLog").doc();
  const approved = status === "approved";
  const decisionMessage = approved
    ? ""
    : requireDecisionMessage(req.body.message);
  let authUser;

  try {
    authUser = await adminAuth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw createRouteError(404, "Firebase Authentication account not found.");
    }

    throw error;
  }

  if (approved && !authUser.emailVerified) {
    throw createRouteError(
      409,
      "The customer must verify their email before approval."
    );
  }

  await adminDb.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw createRouteError(404, "Customer account not found.");
    }

    const customer = userSnapshot.data();

    if (customer.role !== "customer") {
      throw createRouteError(400, "Only customer accounts can be reviewed.");
    }

    if (approved && !hasRegistrationLocation(customer.registrationLocation)) {
      throw createRouteError(
        409,
        "Registration location is required before approval."
      );
    }

    if (customer.status !== "pending") {
      throw createRouteError(
        409,
        `Customer account is already ${customer.status || "reviewed"}.`
      );
    }

    transaction.update(userRef, approved
      ? {
          status: "active",
          accountMessage: "",
          email: authUser.email || customer.email || "",
          emailVerified: true,
          emailVerifiedAt: FieldValue.serverTimestamp(),
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: admin.id,
          approvedByName: admin.name,
          deniedAt: null,
          deniedBy: null,
          deniedByName: null
        }
      : {
          status: "denied",
          accountMessage: decisionMessage,
          email: authUser.email || customer.email || "",
          emailVerified: authUser.emailVerified,
          emailVerifiedAt: authUser.emailVerified
            ? FieldValue.serverTimestamp()
            : null,
          deniedAt: FieldValue.serverTimestamp(),
          deniedBy: admin.id,
          deniedByName: admin.name,
          approvedAt: null,
          approvedBy: null,
          approvedByName: null
        });

    transaction.set(notificationRef, {
      recipientId: userId,
      recipientName: customer.name || "",
      recipientEmail: customer.email || "",
      type: approved ? "account-approved" : "account-denied",
      message: approved
        ? "Your account has been approved. You can now access the document portal."
        : `Your account request was denied. Reason: ${decisionMessage}`,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(auditRef, {
      customerId: userId,
      customer: customer.name || "",
      company: customer.company || "",
      document: "Customer Account",
      action: approved ? "Account Approved" : "Account Denied",
      reason: decisionMessage,
      adminId: admin.id,
      admin: admin.name,
      adminEmail: admin.email,
      requestId: "",
      createdAt: FieldValue.serverTimestamp()
    });
  });
}

/**
 * Revokes an active customer and stores the message they will see at login.
 */
async function revokeActiveCustomer(req) {
  const { userId } = req.params;
  const decisionMessage = requireDecisionMessage(req.body.message);
  const admin = adminIdentity(req);
  const userRef = adminDb.collection("users").doc(userId);
  const notificationRef = adminDb
    .collection("notifications")
    .doc(`${userId}_account-revoked`);
  const auditRef = adminDb.collection("auditLog").doc();

  await adminDb.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw createRouteError(404, "Customer account not found.");
    }

    const customer = userSnapshot.data();

    if (customer.role !== "customer") {
      throw createRouteError(400, "Only customer accounts can be revoked.");
    }

    if (customer.status !== "active") {
      throw createRouteError(
        409,
        `Only active customer accounts can be revoked. This account is ${customer.status || "inactive"}.`
      );
    }

    transaction.update(userRef, {
      status: "revoked",
      accountMessage: decisionMessage,
      revokedAt: FieldValue.serverTimestamp(),
      revokedBy: admin.id,
      revokedByName: admin.name
    });

    transaction.set(notificationRef, {
      recipientId: userId,
      recipientName: customer.name || "",
      recipientEmail: customer.email || "",
      type: "account-revoked",
      message: `Your account access was revoked. Reason: ${decisionMessage}`,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(auditRef, {
      customerId: userId,
      customer: customer.name || "",
      company: customer.company || "",
      document: "Customer Account",
      action: "Account Revoked",
      reason: decisionMessage,
      adminId: admin.id,
      admin: admin.name,
      adminEmail: admin.email,
      requestId: "",
      createdAt: FieldValue.serverTimestamp()
    });
  });
}

/**
 * Grants or removes admin privileges for an active non-owner account.
 */
async function updateAdminRole(req, nextRole) {
  requireOwnerAccess(req);

  const { userId } = req.params;
  const owner = adminIdentity(req);
  const userRef = adminDb.collection("users").doc(userId);
  const notificationRef = adminDb.collection("notifications").doc();
  const auditRef = adminDb.collection("auditLog").doc();
  const grantingAdmin = nextRole === "admin";
  let authUser = null;

  try {
    authUser = await adminAuth.getUser(userId);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }
  }

  await adminDb.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw createRouteError(404, "User account not found.");
    }

    const targetUser = userSnapshot.data();

    if (targetUser.role === OWNER_ROLE) {
      throw createRouteError(409, "The owner account cannot be changed here.");
    }

    if (grantingAdmin) {
      if (targetUser.role === "admin") {
        throw createRouteError(409, "This user is already an admin.");
      }

      if (targetUser.status !== "active") {
        throw createRouteError(409, "Only active users can be made admin.");
      }
    } else if (targetUser.role !== "admin") {
      throw createRouteError(409, "Only admin users can have admin access revoked.");
    }

    transaction.update(userRef, {
      role: nextRole,
      roleUpdatedAt: FieldValue.serverTimestamp(),
      roleUpdatedBy: owner.id,
      roleUpdatedByName: owner.name,
      adminGrantedAt: grantingAdmin ? FieldValue.serverTimestamp() : null,
      adminGrantedBy: grantingAdmin ? owner.id : null,
      adminGrantedByName: grantingAdmin ? owner.name : null,
      adminRevokedAt: grantingAdmin ? null : FieldValue.serverTimestamp(),
      adminRevokedBy: grantingAdmin ? null : owner.id,
      adminRevokedByName: grantingAdmin ? null : owner.name
    });

    transaction.set(notificationRef, {
      recipientId: userId,
      recipientName: targetUser.name || "",
      recipientEmail: authUser?.email || targetUser.email || "",
      type: grantingAdmin ? "admin-granted" : "admin-revoked",
      message: grantingAdmin
        ? "Your account has been granted admin access."
        : "Your admin access has been revoked. Your account remains active as a customer.",
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(auditRef, {
      customerId: userId,
      customer: targetUser.name || "",
      company: targetUser.company || "",
      document: "User Role",
      action: grantingAdmin ? "Admin Granted" : "Admin Revoked",
      reason: "",
      adminId: owner.id,
      admin: owner.name,
      adminEmail: owner.email,
      requestId: "",
      createdAt: FieldValue.serverTimestamp()
    });
  });

  const updatedSnapshot = await userRef.get();

  return formatUserSnapshot(updatedSnapshot, authUser);
}

// Returns the authenticated admin's basic identity for quick frontend checks.
router.get("/me", (req, res) => {
  res.status(200).json({
    uid: req.auth.uid,
    email: req.auth.email || null,
    role: req.userProfile.role,
    status: req.userProfile.status
  });
});

// Lists pending customers and refreshes email verification data from Firebase Auth.
router.get("/pending", async (req, res) => {
  const snapshot = await adminDb
    .collection("users")
    .where("status", "==", "pending")
    .get();

  const customerSnapshots = snapshot.docs
    .filter((customerSnapshot) => customerSnapshot.data().role === "customer");
  const authUsers = await loadAuthUsers(
    customerSnapshots.map((customerSnapshot) => customerSnapshot.id)
  );
  const verificationUpdates = [];
  const users = customerSnapshots
    .map((customerSnapshot) => {
      const data = customerSnapshot.data();
      const authUser = authUsers.get(customerSnapshot.id);
      const emailVerified = authUser?.emailVerified === true;
      const authEmail = authUser?.email || data.email || "";

      if (
        data.emailVerified !== emailVerified
        || data.email !== authEmail
      ) {
        verificationUpdates.push(customerSnapshot.ref.update({
          email: authEmail,
          emailVerified,
          emailVerifiedAt: emailVerified
            ? FieldValue.serverTimestamp()
            : null
        }));
      }

      return formatCustomerSnapshot(customerSnapshot, authUser);
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });

  await Promise.all(verificationUpdates);

  res.status(200).json({ users });
});

// Lists active customers for admin document targeting controls.
router.get("/active-customers", async (req, res) => {
  const snapshot = await adminDb
    .collection("users")
    .where("status", "==", "active")
    .get();

  const customerSnapshots = snapshot.docs
    .filter((customerSnapshot) => customerSnapshot.data().role === "customer");
  const authUsers = await loadAuthUsers(
    customerSnapshots.map((customerSnapshot) => customerSnapshot.id)
  );
  const users = customerSnapshots
    .map((customerSnapshot) => (
      formatCustomerSnapshot(customerSnapshot, authUsers.get(customerSnapshot.id))
    ))
    .sort((a, b) => (
      (a.company || "").localeCompare(b.company || "")
      || (a.name || "").localeCompare(b.name || "")
    ));

  res.status(200).json({ users });
});

// Lists every user profile for the owner-only role management table.
router.get("/all", async (req, res) => {
  requireOwnerAccess(req);

  const snapshot = await adminDb.collection("users").get();
  const authUsers = await loadAuthUsers(
    snapshot.docs.map((userSnapshot) => userSnapshot.id)
  );
  const users = snapshot.docs
    .map((userSnapshot) => (
      formatUserSnapshot(userSnapshot, authUsers.get(userSnapshot.id))
    ))
    .sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, customer: 2 };
      const roleSort = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);

      return roleSort
        || (a.name || "").localeCompare(b.name || "")
        || (a.email || "").localeCompare(b.email || "");
    });

  res.status(200).json({ users });
});

// Lets the owner promote an active user to admin.
router.post("/:userId/make-admin", async (req, res) => {
  const user = await updateAdminRole(req, "admin");

  res.status(200).json({
    message: "Admin access granted.",
    user
  });
});

// Lets the owner remove admin privileges without deleting the account.
router.post("/:userId/revoke-admin", async (req, res) => {
  const user = await updateAdminRole(req, "customer");

  res.status(200).json({
    message: "Admin access revoked.",
    user
  });
});

// Marks a pending customer as active after email verification and location checks pass.
router.post("/:userId/approve", async (req, res) => {
  await reviewPendingCustomer(req, "approved");

  res.status(200).json({
    message: "Customer account approved.",
    userId: req.params.userId,
    status: "active"
  });
});

// Marks a pending customer as denied and saves the admin's explanation.
router.post("/:userId/deny", async (req, res) => {
  await reviewPendingCustomer(req, "denied");

  res.status(200).json({
    message: "Customer account denied.",
    userId: req.params.userId,
    status: "denied"
  });
});

// Marks an active customer as revoked and saves the admin's explanation.
router.post("/:userId/revoke", async (req, res) => {
  await revokeActiveCustomer(req);

  res.status(200).json({
    message: "Customer account revoked.",
    userId: req.params.userId,
    status: "revoked"
  });
});

export default router;

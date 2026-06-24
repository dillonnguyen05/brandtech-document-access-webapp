import "dotenv/config";
import cors from "cors";
import express from "express";

import requireActiveUser from "./middleware/requireActiveUser.js";
import requireAdmin from "./middleware/requireAdmin.js";
import requireCustomer from "./middleware/requireCustomer.js";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken.js";
import accessRequestsRouter, {
  customerAccessRequestsRouter
} from "./routes/accessRequests.js";
import adminUsersRouter from "./routes/adminUsers.js";
import auditLogRouter from "./routes/auditLog.js";
import documentsRouter, {
  documentAccessRouter
} from "./routes/documents.js";
import notificationsRouter from "./routes/notifications.js";
import registrationRouter from "./routes/registration.js";

const app = express();

const port = Number(process.env.PORT) || 3000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Hide framework details and trust the first proxy when deployed behind hosting infrastructure.
app.disable("x-powered-by");
app.set("trust proxy", 1);

// Allow the Vite frontend to call this API and parse normal JSON request bodies.
app.use(cors({
  origin: clientOrigin
}));
app.use(express.json({ limit: "1mb" }));

// Logs every frontend/backend request so it is obvious when React is reaching Express.
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const origin = req.get("origin") || "direct request";

    console.log(
      `[Frontend connection] ${req.method} ${req.originalUrl} -> ${res.statusCode} from ${origin} (${Date.now() - startedAt}ms)`
    );
  });

  next();
});

// Lightweight route used by the frontend startup check and manual browser testing.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "brandtech-api"
  });
});

// Registration starts with a Firebase token, then creates the customer profile through Express.
app.use(
  "/api/register",
  verifyFirebaseToken,
  registrationRouter
);

// Admin-only routes are protected by Firebase token verification and role/status middleware.
app.use(
  "/api/admin/users",
  verifyFirebaseToken,
  requireAdmin,
  adminUsersRouter
);
app.use(
  "/api/admin/access-requests",
  verifyFirebaseToken,
  requireAdmin,
  accessRequestsRouter
);
app.use(
  "/api/admin/documents",
  verifyFirebaseToken,
  requireAdmin,
  documentsRouter
);
app.use(
  "/api/admin/audit-log",
  verifyFirebaseToken,
  requireAdmin,
  auditLogRouter
);

// Customer-facing routes require a valid, active account before document actions are allowed.
app.use(
  "/api/documents",
  verifyFirebaseToken,
  requireActiveUser,
  documentAccessRouter
);
app.use(
  "/api/access-requests",
  verifyFirebaseToken,
  requireActiveUser,
  requireCustomer,
  customerAccessRequestsRouter
);
app.use(
  "/api/notifications",
  verifyFirebaseToken,
  requireActiveUser,
  notificationsRouter
);

// Any URL not mounted above returns a consistent JSON 404 instead of an HTML Express page.
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
    method: req.method,
    path: req.originalUrl
  });
});

// Central error handler converts thrown route errors into JSON responses for the frontend.
app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File must be 50 MB or smaller."
    });
  }

  if (error.name === "MulterError") {
    return res.status(400).json({
      error: error.message || "Invalid file upload."
    });
  }

  return res.status(error.status || 500).json({
    error: error.message || "Internal server error."
  });
});

// Starts the local API server for frontend requests.
app.listen(port, () => {
  console.log(`BrandTech API running at http://localhost:${port}`);
  console.log(`CORS enabled for ${clientOrigin}`);
});

export default app;

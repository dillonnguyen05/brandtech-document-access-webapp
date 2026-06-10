import "dotenv/config";
import cors from "cors";
import express from "express";

import requireAdmin from "./middleware/requireAdmin.js";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken.js";
import accessRequestsRouter from "./routes/accessRequests.js";
import adminUsersRouter from "./routes/adminUsers.js";
import documentsRouter from "./routes/documents.js";

const app = express();

const port = Number(process.env.PORT) || 3000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.disable("x-powered-by");

app.use(cors({
  origin: clientOrigin
}));
app.use(express.json({ limit: "1mb" }));

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

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "brandtech-api"
  });
});

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

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
    method: req.method,
    path: req.originalUrl
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(error.status || 500).json({
    error: error.message || "Internal server error."
  });
});

app.listen(port, () => {
  console.log(`BrandTech API running at http://localhost:${port}`);
  console.log(`CORS enabled for ${clientOrigin}`);
});

export default app;

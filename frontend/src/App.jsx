import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
// Functions from AuthContext.jsx; check Firebase login state and expose the current app user.
import { AuthProvider, useAuth } from "./context/AuthContext";
// Function from apiClient.js; checks that the Express backend is reachable.
import { checkApiConnection } from "./services/apiClient.js";
// Page component from Login.jsx; handles sign-in UI.
import Login from "./pages/Login";
// Page component from Register.jsx; handles customer account registration UI.
import Register from "./pages/Register";
// Page component from AdminDashboard.jsx; handles admin-only portal screens.
import AdminDashboard from "./pages/AdminDashboard";
// Page component from CustomerDashboard.jsx; handles customer-only portal screens.
import CustomerDashboard from "./pages/CustomerDashboard";

/**
 * Keeps authenticated users on the correct side of the app.
 * React Router handles the screen redirect, while Express still enforces API permissions.
 */
function ProtectedRoute({
  children,
  role
}) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

/**
 * Defines the public and protected routes for the single-page React app.
 */
function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Routes>
      <Route
    path="/"
    element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace /> : <Navigate to="/login" replace />}
  />
      <Route path="/login" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route
    path="/admin"
    element={<ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>}
  />
      <Route
    path="/dashboard"
    element={<ProtectedRoute role="customer">
            <CustomerDashboard />
          </ProtectedRoute>}
  />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>;
}

/**
 * Shared loading state shown while Firebase restores the current auth session.
 */
function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#F7F8F9] text-sm font-medium text-[#565A5C]">
      Loading...
    </div>;
}

/**
 * Wires together auth context, routing, and the startup Express health check.
 */
function App() {
  useEffect(() => {
    // Function from apiClient.js: checks that the Express API is reachable.
    checkApiConnection()
      .then((result) => {
        console.info(
          `[BrandTech API] Frontend connected to Express: ${result.service}`
        );
      })
      .catch((error) => {
        console.error(
          "[BrandTech API] Frontend could not connect to Express.",
          error
        );
      });
  }, []);

  return <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>;
}
export {
  App as default
};

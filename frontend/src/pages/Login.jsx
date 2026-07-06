import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Mail, Lock, ChevronRight } from "lucide-react";
// Function from AuthContext.jsx; checks login credentials and returns the user's role.
import { useAuth } from "../context/AuthContext";
import logo from "../imports/brandtech.jpg";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_GRAY = "#565A5C";

/**
 * Sign-in page for admins and customers.
 * The AuthContext decides the final destination based on the user's Firestore role.
 */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  /**
   * Submits credentials to Firebase Auth through AuthContext and redirects by role.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    try {
      // Function from AuthContext.jsx: checks Firebase login and returns the user's role.
      const result = await login(email, password);
      if (result.success) {
        navigate(result.role === "admin" ? "/admin" : "/dashboard");
      } else {
        setError(result.error || "Login failed.");
      }
    } catch (error) {
      console.error(error);
      setError(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };
  return <div className="flex h-screen w-full overflow-hidden">
      {
    /* Left Side — Branding */
  }
      <div
    className="hidden lg:flex flex-col w-1/2 relative overflow-hidden"
    style={{ backgroundColor: "#FFFFFF" }}
  >
        {
    /* Black top bar */
  }
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: BS_BLACK }} />

        <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-14">
          {
    /* Logo — no card needed, white bg blends in */
  }
          <div className="mb-10">
            <img src={logo} alt="BrandTech by BrandSafway" className="w-80 h-auto" />
          </div>

          <h1
    className="text-[28px] text-center mb-3 leading-snug"
    style={{ fontWeight: 500, letterSpacing: "-0.015em", color: BS_BLACK }}
  >
            Secure Document Access Portal
          </h1>

          <div className="w-12 h-[2px] mb-5" style={{ backgroundColor: BS_BLACK }} />

          <p className="text-center text-sm max-w-xs leading-relaxed" style={{ color: BS_GRAY }}>
            Manage and access project documents securely. Restricted to authorized personnel and registered customers.
          </p>

          <div className="mt-10 w-full max-w-xs space-y-3.5">
            {[
    "Role-based document access control",
    "Secure approval workflows",
    "Complete audit trail logging"
  ].map((item) => <div key={item} className="flex items-center gap-3">
                <ChevronRight size={13} style={{ color: BS_BLACK, flexShrink: 0 }} />
                <span className="text-sm" style={{ color: BS_GRAY }}>
                  {item}
                </span>
              </div>)}
          </div>

        </div>

        <div className="relative z-10 text-center pb-6">
          <p className="text-xs" style={{ color: "#B0B5BA" }}>
            © 2026 BrandSafway. All rights reserved.
          </p>
        </div>
      </div>

      {
    /* Right Side — Login Form */
  }
      <div
    className="flex flex-col items-center justify-center w-full lg:w-1/2 px-6 overflow-auto"
    style={{ backgroundColor: BS_GOLD }}
  >
        {
    /* Mobile logo */
  }
        <div className="lg:hidden mb-8">
          <img src={logo} alt="BrandSafway" className="h-12 w-auto" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-xl" style={{ fontWeight: 600, color: BS_BLACK }}>
                Sign In
              </h2>
              <p className="mt-1 text-sm" style={{ color: BS_GRAY }}>
                Enter your credentials to continue.
              </p>
            </div>

            {error && <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
                {error}
              </div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="you@brandsafway.com"
    required
    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] focus:border-transparent transition-all"
    style={{ color: BS_BLACK }}
  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="••••••••"
    required
    className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] focus:border-transparent transition-all"
    style={{ color: BS_BLACK }}
  />
                  <button
    type="button"
    onClick={() => setShowPassword((p) => !p)}
    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
    style={{ color: "#9CA3AF" }}
  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" className="text-xs hover:underline" style={{ color: BS_GRAY }}>
                  Forgot Password?
                </button>
              </div>

              <button
    type="submit"
    disabled={loading}
    className="w-full py-2.5 rounded-lg text-sm transition-opacity disabled:opacity-60 hover:opacity-80"
    style={{ backgroundColor: BS_BLACK, color: "#FFFFFF", fontWeight: 600 }}
  >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <span className="text-sm" style={{ color: BS_GRAY }}>
                Don't have an account?{" "}
              </span>
              <Link to="/register" className="text-sm hover:underline" style={{ color: BS_BLACK, fontWeight: 600 }}>
                Register Account
              </Link>
            </div>

            {
    /* Demo credentials */
  }
          </div>
        </div>
      </div>
    </div>;
}
export {
  Login as default
};

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Mail, Lock, User, Building2, Phone, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../imports/brandtech.jpg";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_GRAY = "#565A5C";
function Register() {
  const [form, setForm] = useState({
    fullName: "",
    company: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms of Service to continue.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    const result = await register(form);
    setLoading(false);
    if (result.success) {
      setSuccess(result.message || "Account created. Please verify your email before signing in.");
      setTimeout(() => navigate("/login"), 3000);
    } else {
      setError(result.error || "Registration failed.");
    }
  };
  const inputClass = "w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] focus:border-transparent transition-all";
  return <div className="flex h-screen w-full overflow-hidden">
      {
    /* Left Side — Branding */
  }
      <div
    className="hidden lg:flex flex-col w-1/2 relative overflow-hidden"
    style={{ backgroundColor: "#FFFFFF" }}
  >
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: BS_BLACK }} />

        <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-14">
          <div className="mb-10">
            <img src={logo} alt="BrandTech by BrandSafway" className="w-80 h-auto" />
          </div>

          <h1
    className="text-[28px] text-center mb-3 leading-snug"
    style={{ fontWeight: 500, letterSpacing: "-0.015em", color: BS_BLACK }}
  >
            Create Your Account
          </h1>

          <div className="w-12 h-[2px] mb-5" style={{ backgroundColor: BS_BLACK }} />

          <p className="text-center text-sm max-w-xs leading-relaxed" style={{ color: BS_GRAY }}>
            Register to request access to BrandSafway project documents. All accounts are reviewed before access is granted.
          </p>

          <div className="mt-10 w-full max-w-xs space-y-3.5">
            {[
    "Secure self-service registration",
    "Request access to specific documents",
    "Real-time status notifications"
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
    /* Right Side — Registration Form */
  }
      <div
    className="flex flex-col items-center justify-center w-full lg:w-1/2 px-6 overflow-auto py-8"
    style={{ backgroundColor: BS_GOLD }}
  >
        <div className="lg:hidden mb-6">
          <img src={logo} alt="BrandTech by BrandSafway" className="h-12 w-auto" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-xl" style={{ fontWeight: 600, color: BS_BLACK }}>
                Create Account
              </h2>
              <p className="mt-1 text-sm" style={{ color: BS_GRAY }}>
                Customer registration — Admin accounts are created internally.
              </p>
            </div>

            {error && <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
                {error}
              </div>}

            {success && <div className="mb-4 px-4 py-3 rounded-lg text-sm text-green-700 bg-green-50 border border-green-100">
                {success}
              </div>}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type="text"
    value={form.fullName}
    onChange={update("fullName")}
    placeholder="John Smith"
    required
    className={inputClass}
    style={{ color: BS_BLACK }}
  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Company Name
                </label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type="text"
    value={form.company}
    onChange={update("company")}
    placeholder="Acme Corporation"
    required
    className={inputClass}
    style={{ color: BS_BLACK }}
  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type="email"
    value={form.email}
    onChange={update("email")}
    placeholder="you@company.com"
    required
    className={inputClass}
    style={{ color: BS_BLACK }}
  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type="tel"
    value={form.phone}
    onChange={update("phone")}
    placeholder="+1 (555) 000-0000"
    required
    className={inputClass}
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
    value={form.password}
    onChange={update("password")}
    placeholder="Min. 6 characters"
    required
    className={`${inputClass} pr-10`}
    style={{ color: BS_BLACK }}
  />
                  <button
    type="button"
    onClick={() => setShowPassword((p) => !p)}
    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60"
    style={{ color: "#9CA3AF" }}
  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: BS_BLACK, fontWeight: 500 }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
    type={showConfirm ? "text" : "password"}
    value={form.confirmPassword}
    onChange={update("confirmPassword")}
    placeholder="••••••••"
    required
    className={`${inputClass} pr-10`}
    style={{ color: BS_BLACK }}
  />
                  <button
    type="button"
    onClick={() => setShowConfirm((p) => !p)}
    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60"
    style={{ color: "#9CA3AF" }}
  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <input
    id="terms"
    type="checkbox"
    checked={agreed}
    onChange={(e) => setAgreed(e.target.checked)}
    className="mt-0.5 h-4 w-4 rounded border-gray-300 cursor-pointer"
    style={{ accentColor: BS_GOLD }}
  />
                <label htmlFor="terms" className="text-sm cursor-pointer select-none" style={{ color: BS_GRAY }}>
                  I agree to the{" "}
                  <button type="button" className="hover:underline" style={{ color: BS_BLACK }}>
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button type="button" className="hover:underline" style={{ color: BS_BLACK }}>
                    Privacy Policy
                  </button>
                </label>
              </div>

              <button
    type="submit"
    disabled={loading}
    className="w-full py-2.5 rounded-lg text-sm transition-opacity disabled:opacity-60 hover:opacity-90 mt-2"
    style={{ backgroundColor: BS_BLACK, color: "#FFFFFF", fontWeight: 600 }}
  >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <span className="text-sm" style={{ color: BS_GRAY }}>
                Already have an account?{" "}
              </span>
              <Link to="/login" className="text-sm hover:underline" style={{ color: BS_BLACK, fontWeight: 600 }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>;
}
export {
  Register as default
};

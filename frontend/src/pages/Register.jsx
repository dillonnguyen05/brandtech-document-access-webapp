import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Mail, Lock, User, Building2, Phone, ChevronRight, MapPin } from "lucide-react";
// Function from AuthContext.jsx; checks registration data and starts the customer account flow.
import { useAuth } from "../context/AuthContext";
import logo from "../imports/brandtech.jpg";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_GRAY = "#565A5C";
const COUNTRY_CODES = [
  { id: "US", label: "🇺🇸 +1", dialCode: "+1", name: "United States", minLength: 10, maxLength: 10 },
  { id: "CA", label: "🇨🇦 +1", dialCode: "+1", name: "Canada", minLength: 10, maxLength: 10 },
  { id: "MX", label: "🇲🇽 +52", dialCode: "+52", name: "Mexico", minLength: 10, maxLength: 10 },
  { id: "GB", label: "🇬🇧 +44", dialCode: "+44", name: "United Kingdom", minLength: 10, maxLength: 10 },
  { id: "IN", label: "🇮🇳 +91", dialCode: "+91", name: "India", minLength: 10, maxLength: 10 },
  { id: "PH", label: "🇵🇭 +63", dialCode: "+63", name: "Philippines", minLength: 10, maxLength: 10 },
  { id: "BR", label: "🇧🇷 +55", dialCode: "+55", name: "Brazil", minLength: 10, maxLength: 11 },
  { id: "DE", label: "🇩🇪 +49", dialCode: "+49", name: "Germany", minLength: 5, maxLength: 11 },
  { id: "FR", label: "🇫🇷 +33", dialCode: "+33", name: "France", minLength: 9, maxLength: 9 },
  { id: "AU", label: "🇦🇺 +61", dialCode: "+61", name: "Australia", minLength: 9, maxLength: 9 }
];

/**
 * Requests browser geolocation for registration.
 * The backend requires this location before creating the customer profile.
 */
function getRegistrationLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location access is required to register, but this browser does not support location services."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      () => {
        reject(new Error("Location access is required to register for this portal."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Customer registration page with email verification, phone validation, and location capture.
 */
function Register() {
  const [form, setForm] = useState({
    fullName: "",
    company: "",
    email: "",
    phoneCountry: "US",
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
  const [locationStatus, setLocationStatus] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();
  const selectedCountry = COUNTRY_CODES.find(
    (country) => country.id === form.phoneCountry
  ) || COUNTRY_CODES[0];

  /**
   * Creates a small setter for basic text inputs.
   */
  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  /**
   * Changes country code rules and trims the typed phone number if the new country is shorter.
   */
  const updatePhoneCountry = (e) => {
    const nextCountry = COUNTRY_CODES.find(
      (country) => country.id === e.target.value
    ) || COUNTRY_CODES[0];

    setForm((prev) => ({
      ...prev,
      phoneCountry: nextCountry.id,
      phone: prev.phone.slice(0, nextCountry.maxLength)
    }));
  };

  /**
   * Keeps phone input numeric and within the selected country's maximum length.
   */
  const updatePhone = (e) => {
    const digitsOnly = e.target.value
      .replace(/\D/g, "")
      .slice(0, selectedCountry.maxLength);

    setForm((prev) => ({ ...prev, phone: digitsOnly }));
  };

  /**
   * Validates the registration form, captures location, then asks AuthContext to register.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.phone || /\D/.test(form.phone)) {
      setError("Phone number must contain numbers only with no spaces or dashes.");
      return;
    }
    if (
      form.phone.length < selectedCountry.minLength
      || form.phone.length > selectedCountry.maxLength
    ) {
      const requiredLength = selectedCountry.minLength === selectedCountry.maxLength
        ? `${selectedCountry.minLength} digits`
        : `${selectedCountry.minLength}-${selectedCountry.maxLength} digits`;

      setError(
        `Enter ${requiredLength} for ${selectedCountry.name}.`
      );
      return;
    }
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
    setLocationStatus("Requesting registration location...");

    let registrationLocation;

    try {
      registrationLocation = await getRegistrationLocation();
    } catch (locationError) {
      setLoading(false);
      setLocationStatus("");
      setError(locationError.message);
      return;
    }

    setLocationStatus("Creating account...");
    // Function from AuthContext.jsx: checks registration data and starts Firebase/Express account creation.
    const result = await register({
      ...form,
      phone: `${selectedCountry.dialCode}${form.phone}`,
      registrationLocation
    });
    setLoading(false);
    setLocationStatus("");
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
    placeholder="Dillon Nguyen"
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
    placeholder="BrandTech"
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
    placeholder="you@brandsafway.com"
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
                <div className="flex gap-2">
                  <select
    value={form.phoneCountry}
    onChange={updatePhoneCountry}
    aria-label="Country code"
    className="w-[116px] px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] focus:border-transparent transition-all"
    style={{ color: BS_BLACK }}
  >
                    {COUNTRY_CODES.map((country) => <option key={country.id} value={country.id}>
                        {country.label}
                      </option>)}
                  </select>
                  <div className="relative flex-1">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                    <input
      type="tel"
      inputMode="numeric"
      value={form.phone}
      onChange={updatePhone}
      placeholder="5550000000"
      minLength={selectedCountry.minLength}
      maxLength={selectedCountry.maxLength}
      required
      className={inputClass}
      style={{ color: BS_BLACK }}
    />
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs" style={{ color: "#8B949E" }}>
                  <p>
                    Numbers only. Enter {selectedCountry.minLength === selectedCountry.maxLength
                      ? `${selectedCountry.maxLength} digits`
                      : `${selectedCountry.minLength}-${selectedCountry.maxLength} digits`}.
                  </p>
                  <span className="flex-shrink-0" aria-live="polite">
                    {form.phone.length}/{selectedCountry.maxLength}
                  </span>
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
                    <a href="https://brandsafway.com/terms-of-use" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </a>
                  </button>{" "}
                  and{" "}
                  <button type="button" className="hover:underline" style={{ color: BS_BLACK }}>
                    <a href="https://brandsafway.com/privacy-policy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </a>
                  </button>
                </label>
              </div>

              <div
                className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs"
                style={{
                  backgroundColor: "#F9FAFB",
                  borderColor: "#E5E7EB",
                  color: BS_GRAY
                }}
              >
                <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: BS_GOLD }} />
                <p>
                  Registration location is required for admin review. If location access is denied, the account cannot be created.
                </p>
              </div>

              <button
    type="submit"
    disabled={loading}
    className="w-full py-2.5 rounded-lg text-sm transition-opacity disabled:opacity-60 hover:opacity-90 mt-2"
    style={{ backgroundColor: BS_BLACK, color: "#FFFFFF", fontWeight: 600 }}
  >
                {loading ? locationStatus || "Creating Account..." : "Create Account"}
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

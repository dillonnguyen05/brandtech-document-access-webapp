import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  History,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  Upload,
  CheckCircle,
  XCircle,
  RotateCcw,
  Users,
  Files,
  Clock,
  Camera,
  UserCircle
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseConfig";
import {
  INITIAL_DOCUMENTS,
  INITIAL_REQUESTS,
  INITIAL_AUDIT
} from "../data/mockData";
import logo from "../imports/brandtech.jpg";
import {
  listenToDocuments,
  uploadDocument
} from "../services/documentService.js";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_MAROON = "#8A2A2B";
const BS_GRAY = "#565A5C";
const BS_LIGHT = "#F7F8F9";
function StatusBadge({ status }) {
  const map = {
    pending: { bg: "rgba(242,169,0,0.12)", color: "#A37200", label: "Pending" },
    approved: { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Approved" },
    denied: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Denied" },
    "Access Granted": { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Access Granted" },
    "Access Denied": { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Access Denied" },
    "Access Revoked": { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Access Revoked" }
  };
  const cfg = map[status] || { bg: "#F3F4F6", color: BS_GRAY, label: status };
  return <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs"
    style={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 500 }}
  >
      {cfg.label}
    </span>;
}
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "requests", label: "Access Requests", icon: ClipboardList },
  { key: "users", label: "User Approvals", icon: Users },
  { key: "audit", label: "Audit Log", icon: History },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "profile", label: "Profile", icon: UserCircle }
];
function formatDate(value) {
  if (!value) return "—";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
  return String(value);
}
function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [auditLog, setAuditLog] = useState(INITIAL_AUDIT);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [userApprovalError, setUserApprovalError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("PDF");
  const [uploadCategory, setUploadCategory] = useState("Safety");
  const [uploadCustomer, setUploadCustomer] = useState("All Customers");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [documentLoadError, setDocumentLoadError] = useState("");
  const fileRef = useRef(null);
  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const uniqueCustomers = new Set(requests.map((r) => r.customerId)).size;
  useEffect(() => {
    const pendingUsersQuery = query(
      collection(db, "users"),
      where("status", "==", "pending")
    );
    const unsubscribe = onSnapshot(
      pendingUsersQuery,
      (snapshot) => {
        const customers = snapshot.docs
          .map((pendingUserDoc) => ({
            id: pendingUserDoc.id,
            ...pendingUserDoc.data()
          }))
          .filter((pendingUser) => pendingUser.role === "customer");

        setPendingUsers(customers);
        setUserApprovalError("");
      },
      (error) => {
        console.error(error);
        setUserApprovalError("Unable to load pending users.");
      }
    );

    return unsubscribe;
  }, []);
  useEffect(() => {
    const unsubscribe = listenToDocuments(
      (firestoreDocuments) => {
        setDocuments(firestoreDocuments);
        setDocumentLoadError("");
      },
      (error) => {
        console.error(error);
        setDocumentLoadError("Unable to load uploaded documents.");
      }
    );

    return unsubscribe;
  }, []);
  const approveRequest = (id) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" } : r));
    const entry = {
      id: `a${Date.now()}`,
      customer: req.customerName,
      company: req.company,
      document: req.documentTitle,
      action: "Access Granted",
      admin: user?.name || "Admin",
      timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      requestId: id
    };
    setAuditLog((prev) => [entry, ...prev]);
  };
  const denyRequest = (id) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "denied" } : r));
    const entry = {
      id: `a${Date.now()}`,
      customer: req.customerName,
      company: req.company,
      document: req.documentTitle,
      action: "Access Denied",
      admin: user?.name || "Admin",
      timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      requestId: id
    };
    setAuditLog((prev) => [entry, ...prev]);
  };
  const grantAccess = (requestId) => {
    const auditEntry = auditLog.find((a) => a.requestId === requestId && (a.action === "Access Denied" || a.action === "Access Revoked"));
    if (!auditEntry) return;
    if (requestId) {
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "approved" } : r));
    }
    const newEntry = {
      id: `a${Date.now()}`,
      customer: auditEntry.customer,
      company: auditEntry.company,
      document: auditEntry.document,
      action: "Access Granted",
      admin: user?.name || "Admin",
      timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      requestId
    };
    setAuditLog((prev) => [newEntry, ...prev]);
  };
  const revokeAccess = (requestId) => {
    const entry = auditLog.find((a) => a.requestId === requestId);
    if (!entry) return;
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "denied" } : r));
    const newEntry = {
      id: `a${Date.now()}`,
      customer: entry.customer,
      company: entry.company,
      document: entry.document,
      action: "Access Revoked",
      admin: user?.name || "Admin",
      timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      requestId
    };
    setAuditLog((prev) => [newEntry, ...prev]);
  };
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadTitle) return;
    if (!uploadFile) {
      setUploadError("Please select a file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadDone(false);
    setUploadError("");

    try {
      await uploadDocument(
        uploadFile,
        {
          title: uploadTitle,
          type: uploadType,
          category: uploadCategory,
          targetCustomer: uploadCustomer
        },
        user,
        setUploadProgress
      );

      setUploadDone(true);
      setUploadTitle("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setUploadDone(false), 3e3);
    } catch (error) {
      console.error(error);
      setUploadError(error.message || "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  };
  const approveUser = async (userId) => {
    setUpdatingUserId(userId);
    setUserApprovalError("");
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "active",
        approvedAt: serverTimestamp(),
        approvedBy: user?.id || user?.email || "admin",
        deniedAt: null,
        deniedBy: null
      });
    } catch (error) {
      console.error(error);
      setUserApprovalError("Unable to approve user. Check Firestore permissions.");
    } finally {
      setUpdatingUserId("");
    }
  };
  const denyUser = async (userId) => {
    setUpdatingUserId(userId);
    setUserApprovalError("");
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "denied",
        deniedAt: serverTimestamp(),
        deniedBy: user?.id || user?.email || "admin"
      });
    } catch (error) {
      console.error(error);
      setUserApprovalError("Unable to deny user. Check Firestore permissions.");
    } finally {
      setUpdatingUserId("");
    }
  };
  return <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: BS_LIGHT }}>
      {
    /* Sidebar */
  }
      <aside
    className="flex flex-col flex-shrink-0 h-full"
    style={{
      width: "220px",
      background: "linear-gradient(180deg, #101820 0%, #0B1117 100%)"
    }}
  >
        {
    /* Logo */
  }
        <div className="px-4 py-4">
          <div className="bg-white rounded-md px-3 py-2">
            <img src={logo} alt="BrandSafway" className="h-10 w-auto" />
          </div>
        </div>

        {
    /* Divider */
  }
        <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.05)", margin: "0 16px" }} />

        {
    /* Nav — top-anchored, profile bottom-anchored */
  }
        <div className="flex flex-col flex-1 justify-between overflow-y-auto">
          {
    /* Navigation */
  }
          <nav className="px-3 pt-5">
            {
    /* MAIN group */
  }
            <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "#6A7A86", fontWeight: 700 }}>
              Main
            </p>
            <div className="space-y-0.5">
              {NAV.slice(0, 4).map(({ key, label, icon: Icon }) => {
    const active = section === key;
    return <NavButton
      key={key}
      navKey={key}
      label={label}
      Icon={Icon}
      active={active}
      badge={key === "requests" && pendingCount > 0 ? pendingCount : key === "users" && pendingUsers.length > 0 ? pendingUsers.length : void 0}
      onClick={() => setSection(key)}
    />;
  })}
            </div>

            {
    /* MANAGEMENT group */
  }
            <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "28px 8px 20px" }} />
            <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "#6A7A86", fontWeight: 700 }}>
              Management
            </p>
            <div className="space-y-0.5">
              {NAV.slice(4, 6).map(({ key, label, icon: Icon }) => {
    const active = section === key;
    return <NavButton
      key={key}
      navKey={key}
      label={label}
      Icon={Icon}
      active={active}
      onClick={() => setSection(key)}
    />;
  })}
            </div>

            {
    /* ACCOUNT group */
  }
            <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "20px 8px 16px" }} />
            <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "#6A7A86", fontWeight: 700 }}>
              Account
            </p>
            <div className="space-y-0.5">
              {NAV.slice(6).map(({ key, label, icon: Icon }) => {
    const active = section === key;
    return <NavButton
      key={key}
      navKey={key}
      label={label}
      Icon={Icon}
      active={active}
      onClick={() => setSection(key)}
    />;
  })}
            </div>
          </nav>

          {
    /* Bottom: Profile */
  }
          <div>
            {
    /* Divider */
  }
            <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "0 16px" }} />

            {
    /* Profile + Logout */
  }
            <div className="px-3 py-4">
              <div
    className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg mb-1"
    style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
  >
                <div
    className="h-7 w-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 700 }}
  >
                  {user?.name?.charAt(0) || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate" style={{ fontWeight: 500 }}>{user?.name}</p>
                  <p className="text-[10px] truncate" style={{ color: "#6A7A86" }}>Administrator</p>
                </div>
              </div>
              <button
    onClick={handleLogout}
    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all"
    style={{ color: "#5A6A76" }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "#ef4444";
      e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "#5A6A76";
      e.currentTarget.style.backgroundColor = "transparent";
    }}
  >
                <LogOut size={13} />
                <span className="text-xs">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {
    /* Main */
  }
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {
    /* Top header */
  }
        <header
    className="flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0"
    style={{ backgroundColor: "#FFFFFF", borderColor: "#E9EAEC" }}
  >
          <div>
            <h2 className="text-base" style={{ color: BS_BLACK, fontWeight: 600 }}>
              {NAV.find((n) => n.key === section)?.label}
            </h2>
            <p className="text-xs" style={{ color: BS_GRAY }}>BrandSafway Admin Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
              <input
    type="text"
    placeholder="Search..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-8 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] w-52"
    style={{ color: BS_BLACK }}
  />
            </div>
            <button
    onClick={() => setNotifOpen((p) => !p)}
    aria-label={notifOpen ? "Hide notifications" : "Show notifications"}
    aria-pressed={notifOpen}
    className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
  >
              <Bell size={18} style={{ color: BS_GRAY }} />
              {pendingCount + pendingUsers.length > 0 && <span
    className="absolute top-1 right-1 h-4 w-4 rounded-full text-xs flex items-center justify-center"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 700 }}
  >
                  {pendingCount + pendingUsers.length}
                </span>}
            </button>
            <div className="relative pl-2 border-l border-gray-200" ref={dropdownRef}>
              <button
    onClick={() => setProfileOpen((p) => !p)}
    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
  >
                <div
    className="h-8 w-8 rounded-full flex items-center justify-center text-xs overflow-hidden flex-shrink-0"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 700 }}
  >
                  {profilePic ? <img src={profilePic} alt="avatar" className="w-full h-full object-cover" /> : user?.name?.charAt(0) || "A"}
                </div>
                <ChevronDown size={14} style={{ color: BS_GRAY, transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {profileOpen && <div
    className="absolute right-0 top-11 w-52 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
    style={{ backgroundColor: "#FFFFFF", border: "1px solid #E9EAEC" }}
  >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm truncate" style={{ color: BS_BLACK, fontWeight: 600 }}>{user?.name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: BS_GRAY }}>{user?.email}</p>
                  </div>
                  {[
    { label: "View Profile", icon: UserCircle, action: () => {
      setSection("profile");
      setProfileOpen(false);
    } },
    { label: "Settings", icon: Settings, action: () => {
      setSection("settings");
      setProfileOpen(false);
    } }
  ].map(({ label, icon: Icon, action }) => <button
    key={label}
    onClick={action}
    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50"
    style={{ color: BS_BLACK }}
  >
                      <Icon size={15} style={{ color: BS_GRAY }} />
                      {label}
                    </button>)}
                  <div className="border-t border-gray-100 mt-1">
                    <button
    onClick={() => {
      logout();
      navigate("/login");
    }}
    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-red-50"
    style={{ color: "#ef4444" }}
  >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>}
            </div>
          </div>
        </header>

        {
    /* Content */
  }
        <main className="flex-1 overflow-y-auto p-6">
          {section === "dashboard" && <DashboardContent
    requests={requests}
    documents={documents}
    pendingCount={pendingCount}
    approvedCount={approvedCount}
    uniqueCustomers={uniqueCustomers}
    onApprove={approveRequest}
    onDeny={denyRequest}
  />}
          {section === "documents" && <DocumentsContent
    documents={documents}
    uploadTitle={uploadTitle}
    setUploadTitle={setUploadTitle}
    uploadType={uploadType}
    setUploadType={setUploadType}
    uploadCategory={uploadCategory}
    setUploadCategory={setUploadCategory}
    uploadCustomer={uploadCustomer}
    setUploadCustomer={setUploadCustomer}
    uploadFile={uploadFile}
    setUploadFile={setUploadFile}
    uploadProgress={uploadProgress}
    uploading={uploading}
    uploadDone={uploadDone}
    uploadError={uploadError}
    documentLoadError={documentLoadError}
    fileRef={fileRef}
    onUpload={handleUpload}
  />}
          {section === "requests" && <RequestsContent requests={requests} onApprove={approveRequest} onDeny={denyRequest} />}
          {section === "users" && <UserApprovalsContent
    pendingUsers={pendingUsers}
    error={userApprovalError}
    updatingUserId={updatingUserId}
    onApprove={approveUser}
    onDeny={denyUser}
  />}
          {section === "audit" && <AuditContent auditLog={auditLog} onRevoke={revokeAccess} onGrant={grantAccess} requests={requests} />}
          {section === "settings" && <SettingsContent user={user} />}
          {section === "profile" && <AdminProfileContent user={user} profilePic={profilePic} setProfilePic={setProfilePic} />}
        </main>
      </div>
    </div>;
}
function NavButton({
  label,
  Icon,
  active,
  badge,
  onClick
}) {
  return <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all relative group"
    style={{
      backgroundColor: active ? "rgba(255,255,255,0.08)" : "transparent",
      color: active ? "#FFFFFF" : "#7A8490"
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.backgroundColor = "transparent";
    }}
  >
      {active && <span
    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r"
    style={{ backgroundColor: BS_GOLD }}
  />}
      <Icon size={15} style={{ color: active ? BS_GOLD : "#4A5560", flexShrink: 0 }} />
      <span className="text-sm" style={{ fontWeight: active ? 500 : 400 }}>
        {label}
      </span>
      {badge !== void 0 && <span
    className="ml-auto text-xs rounded-full px-1.5 py-0.5"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600, minWidth: "20px", textAlign: "center" }}
  >
          {badge}
        </span>}
    </button>;
}
function DashboardContent({
  requests,
  documents,
  pendingCount,
  approvedCount,
  uniqueCustomers,
  onApprove,
  onDeny
}) {
  const kpis = [
    { label: "Pending Requests", value: pendingCount, icon: Clock, color: BS_GOLD },
    { label: "Approved Requests", value: approvedCount, icon: CheckCircle, color: "#22C55E" },
    { label: "Total Customers", value: uniqueCustomers, icon: Users, color: "#6366F1" },
    { label: "Active Documents", value: documents.length, icon: Files, color: "#0EA5E9" }
  ];
  return <div className="space-y-6">
      {
    /* KPI row */
  }
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => <div
    key={label}
    className="bg-white rounded-xl border border-gray-100 p-5"
  >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: BS_GRAY }}>{label}</span>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}18` }}>
                <Icon size={15} style={{ color }} />
              </div>
            </div>
            <p className="text-3xl" style={{ color: BS_BLACK, fontWeight: 600 }}>{value}</p>
          </div>)}
      </div>

      {
    /* Access Requests */
  }
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Recent Access Requests</h3>
            <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Review and manage document access requests</p>
          </div>
          {pendingCount > 0 && <span
    className="text-xs px-2.5 py-1 rounded-full"
    style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200", fontWeight: 500 }}
  >
              {pendingCount} pending
            </span>}
        </div>
        <RequestsTable requests={requests.slice(0, 5)} onApprove={onApprove} onDeny={onDeny} />
      </div>
    </div>;
}
function DocumentsContent({
  documents,
  uploadTitle,
  setUploadTitle,
  uploadType,
  setUploadType,
  uploadCategory,
  setUploadCategory,
  uploadCustomer,
  setUploadCustomer,
  uploadFile,
  setUploadFile,
  uploadProgress,
  uploading,
  uploadDone,
  uploadError,
  documentLoadError,
  fileRef,
  onUpload
}) {
  return <div className="space-y-6">
      {
    /* Upload form */
  }
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm mb-4" style={{ color: BS_BLACK, fontWeight: 600 }}>
          Upload Document
        </h3>
        <form onSubmit={onUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Document Title *</label>
            <input
    type="text"
    value={uploadTitle}
    onChange={(e) => setUploadTitle(e.target.value)}
    placeholder="e.g. Safety Manual 2024"
    required
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Document Type</label>
            <select
    value={uploadType}
    onChange={(e) => setUploadType(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
              {["PDF", "Word", "Excel", "PowerPoint", "Other"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Category</label>
            <select
    value={uploadCategory}
    onChange={(e) => setUploadCategory(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
              {["Safety", "Technical", "Compliance", "Operations", "Legal", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Target Customer</label>
            <select
    value={uploadCustomer}
    onChange={(e) => setUploadCustomer(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
              {["All Customers", "Acme Corp", "BuildTech LLC", "Steel Works Inc"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>File</label>
            <div
    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-[#F2A900] transition-colors"
    style={{ borderColor: "#D1D5DB" }}
    onClick={() => fileRef.current?.click()}
  >
              <Upload size={20} className="mx-auto mb-2" style={{ color: "#9CA3AF" }} />
              <p className="text-sm" style={{ color: BS_GRAY }}>
                {uploadFile ? uploadFile.name : "Click to select a file"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>PDF, Word, Excel up to 50MB</p>
            </div>
            <input
    ref={fileRef}
    type="file"
    className="hidden"
    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
  />
  
          </div>

          {uploading && <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: BS_GRAY }}>Uploading...</span>
                <span className="text-xs" style={{ color: BS_GRAY }}>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E9EAEC" }}>
                <div
    className="h-full rounded-full transition-all"
    style={{ width: `${uploadProgress}%`, backgroundColor: BS_GOLD }}
  />
              </div>
            </div>}

          {uploadDone && <div className="md:col-span-2 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle size={16} />
              Document uploaded successfully.
            </div>}

          {uploadError && <div className="md:col-span-2 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
              {uploadError}
            </div>}

          <div className="md:col-span-2">
            <button
    type="submit"
    disabled={uploading}
    className="px-5 py-2.5 rounded-lg text-sm transition-opacity disabled:opacity-50 hover:opacity-90"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </div>

      {
    /* Document list */
  }
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>All Documents</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>{documents.length} documents on record</p>
        </div>
        {documentLoadError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
            {documentLoadError}
          </div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA" }}>
                {["Title", "Category", "Type", "Date", "Size", "Uploaded By"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                    {h}
                  </th>)}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => <tr key={doc.id} style={{ borderBottom: i < documents.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{doc.title}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: BS_GRAY }}>
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.type}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.uploadedDate}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.size}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.uploadedBy}</td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
function RequestsContent({ requests, onApprove, onDeny }) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>All Access Requests</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Manage customer document access requests</p>
      </div>
      <RequestsTable requests={requests} onApprove={onApprove} onDeny={onDeny} />
    </div>;
}
function RequestsTable({ requests, onApprove, onDeny }) {
  return <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#FAFAFA" }}>
            {["Customer", "Company", "Document", "Date Requested", "Status", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                {h}
              </th>)}
          </tr>
        </thead>
        <tbody>
          {requests.map((req, i) => <tr key={req.id} style={{ borderBottom: i < requests.length - 1 ? "1px solid #F3F4F6" : "none" }}>
              <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{req.customerName}</td>
              <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{req.company}</td>
              <td className="px-4 py-3.5 text-xs max-w-[180px] truncate" style={{ color: BS_BLACK }}>{req.documentTitle}</td>
              <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{req.dateRequested}</td>
              <td className="px-4 py-3.5">
                <StatusBadge status={req.status} />
              </td>
              <td className="px-4 py-3.5">
                {req.status === "pending" && <div className="flex items-center gap-2">
                    <button
    onClick={() => onApprove(req.id)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
  >
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
    onClick={() => onDeny(req.id)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 border"
    style={{ borderColor: BS_MAROON, color: BS_MAROON }}
  >
                      <XCircle size={12} /> Deny
                    </button>
                  </div>}
                {req.status !== "pending" && <span className="text-xs" style={{ color: "#C4C9CE" }}>—</span>}
              </td>
            </tr>)}
          {requests.length === 0 && <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                No access requests found.
              </td>
            </tr>}
        </tbody>
      </table>
    </div>;
}
function UserApprovalsContent({
  pendingUsers,
  error,
  updatingUserId,
  onApprove,
  onDeny
}) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Pending User Approvals</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Review new customer accounts before they can access the portal</p>
        </div>
        {pendingUsers.length > 0 && <span
    className="text-xs px-2.5 py-1 rounded-full"
    style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200", fontWeight: 500 }}
  >
            {pendingUsers.length} pending
          </span>}
      </div>

      {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#FAFAFA" }}>
              {["Customer", "Company", "Email", "Phone", "Email Status", "Registered", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                  {h}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map((pendingUser, i) => {
    const isUpdating = updatingUserId === pendingUser.id;
    return <tr key={pendingUser.id} style={{ borderBottom: i < pendingUsers.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{pendingUser.name || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{pendingUser.company || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_BLACK }}>{pendingUser.email || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{pendingUser.phone || "—"}</td>
                <td className="px-4 py-3.5">
                  <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: pendingUser.emailVerified ? "rgba(34,197,94,0.12)" : "rgba(242,169,0,0.12)",
          color: pendingUser.emailVerified ? "#166534" : "#A37200",
          fontWeight: 500
        }}
      >
                    {pendingUser.emailVerified ? "Verified" : "Not verified"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{formatDate(pendingUser.createdAt)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <button
          onClick={() => onApprove(pendingUser.id)}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
        >
                      <CheckCircle size={12} /> {isUpdating ? "Saving..." : "Approve"}
                    </button>
                    <button
          onClick={() => onDeny(pendingUser.id)}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 border disabled:opacity-50"
          style={{ borderColor: BS_MAROON, color: BS_MAROON }}
        >
                      <XCircle size={12} /> Deny
                    </button>
                  </div>
                </td>
              </tr>;
  })}
            {pendingUsers.length === 0 && <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                  No pending customer approvals.
                </td>
              </tr>}
          </tbody>
        </table>
      </div>
    </div>;
}
function AuditContent({ auditLog, onRevoke, onGrant, requests }) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Audit Log</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Complete record of all document access actions</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#FAFAFA" }}>
              {["Customer", "Company", "Document", "Action", "Admin", "Timestamp", "Action"].map((h, i) => <th key={`${h}${i}`} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                  {h}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {auditLog.map((entry, i) => {
    const req = requests.find((r) => r.id === entry.requestId);
    const canRevoke = req?.status === "approved" && entry.action === "Access Granted";
    const canGrant = req?.status === "denied" && entry.action === "Access Denied" || (req?.status === "denied" || !req) && entry.action === "Access Revoked";
    return <tr key={entry.id} style={{ borderBottom: i < auditLog.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{entry.customer}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{entry.company}</td>
                  <td className="px-4 py-3.5 text-xs max-w-[180px] truncate" style={{ color: BS_BLACK }}>{entry.document}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={entry.action} />
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{entry.admin}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{entry.timestamp}</td>
                  <td className="px-4 py-3.5">
                    {canRevoke ? <button
      onClick={() => onRevoke(entry.requestId)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
      style={{ borderColor: BS_MAROON, color: BS_MAROON }}
    >
                        <RotateCcw size={11} /> Revoke
                      </button> : canGrant ? <button
      onClick={() => onGrant(entry.requestId)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
      style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#166534" }}
    >
                        <CheckCircle size={11} /> Grant Access
                      </button> : <span className="text-xs" style={{ color: "#C4C9CE" }}>—</span>}
                  </td>
                </tr>;
  })}
          </tbody>
        </table>
      </div>
    </div>;
}
function SettingsContent({ user }) {
  const [autoCompanies, setAutoCompanies] = useState(["BrandTech Solutions", "Apex Industries"]);
  const [autoUsers, setAutoUsers] = useState(["james.walker@apexind.com"]);
  const [companyInput, setCompanyInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [reviewWindow, setReviewWindow] = useState("7");
  const [pwSaved, setPwSaved] = useState(false);
  function addCompany() {
    const v = companyInput.trim();
    if (v && !autoCompanies.includes(v)) setAutoCompanies((p) => [...p, v]);
    setCompanyInput("");
  }
  function addUser() {
    const v = userInput.trim();
    if (v && !autoUsers.includes(v)) setAutoUsers((p) => [...p, v]);
    setUserInput("");
  }
  return <div className="w-full space-y-8">
      {
    /* Avatar header */
  }
      <div className="flex items-center gap-4">
        <div
    className="h-14 w-14 rounded-full flex items-center justify-center text-xl flex-shrink-0"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 700 }}
  >
          {user?.name?.charAt(0) || "A"}
        </div>
        <div>
          <h3 className="text-base" style={{ color: BS_BLACK, fontWeight: 600 }}>{user?.name}</h3>
          <p className="text-sm" style={{ color: BS_GRAY }}>Administrator</p>
        </div>
      </div>

      {
    /* ── Change Password + Access Request Defaults ── */
  }
      <div className="grid grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border border-gray-100 p-8">
        <h3 className="text-sm mb-4" style={{ color: BS_BLACK, fontWeight: 600 }}>Change Password</h3>
        <div className="space-y-4">
          {["Current Password", "New Password", "Confirm New Password"].map((label) => <div key={label}>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>{label}</label>
              <input
    type="password"
    placeholder="••••••••"
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
  />
            </div>)}
          <button
    onClick={() => {
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    }}
    className="px-5 py-2.5 rounded-lg text-sm border transition-opacity hover:opacity-80"
    style={{ borderColor: BS_BLACK, color: BS_BLACK }}
  >
            {pwSaved ? "\u2713 Saved" : "Change Password"}
          </button>
        </div>
      </div>

        {
    /* ── Access Request Defaults ── */
  }
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <h3 className="text-sm mb-1" style={{ color: BS_BLACK, fontWeight: 600 }}>Access Request Defaults</h3>
          <p className="text-xs mb-5" style={{ color: BS_GRAY }}>Default settings applied to all incoming document access requests.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Review Window (days)</label>
              <select
    value={reviewWindow}
    onChange={(e) => setReviewWindow(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
                {["3", "5", "7", "14", "30"].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: BS_GRAY }}>Requests not reviewed within this window are flagged for escalation.</p>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Default Document Access Duration</label>
              <select
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    defaultValue="90"
  >
                {[["30", "30 days"], ["60", "60 days"], ["90", "90 days"], ["180", "6 months"], ["365", "1 year"], ["0", "No expiry"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: BS_GRAY }}>Approved access expires after this period unless renewed.</p>
            </div>
            <button
    className="px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
              Save Defaults
            </button>
          </div>
        </div>
      </div>

      {
    /* ── Auto-Approval Rules ── */
  }
      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <h3 className="text-sm mb-1" style={{ color: BS_BLACK, fontWeight: 600 }}>Auto-Approval Rules</h3>
        <p className="text-xs mb-6" style={{ color: BS_GRAY }}>
          Document access requests from these companies or individuals are automatically approved without manual review.
        </p>
        <div className="grid grid-cols-2 gap-8">
          {
    /* By Company */
  }
          <div>
            <p className="text-xs mb-3" style={{ color: BS_GRAY, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>By Company</p>
            <div className="flex gap-2 mb-3">
              <input
    value={companyInput}
    onChange={(e) => setCompanyInput(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && addCompany()}
    placeholder="Company name…"
    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
              <button
    onClick={addCompany}
    className="px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {autoCompanies.map((c) => <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                  <span className="text-sm" style={{ color: BS_BLACK }}>{c}</span>
                  <button
    onClick={() => setAutoCompanies((p) => p.filter((x) => x !== c))}
    className="text-xs px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
    style={{ color: BS_MAROON }}
  >
                    Remove
                  </button>
                </div>)}
              {autoCompanies.length === 0 && <p className="text-xs py-2" style={{ color: BS_GRAY }}>No companies added yet.</p>}
            </div>
          </div>

          {
    /* By Individual */
  }
          <div>
            <p className="text-xs mb-3" style={{ color: BS_GRAY, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>By Individual</p>
            <div className="flex gap-2 mb-3">
              <input
    value={userInput}
    onChange={(e) => setUserInput(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && addUser()}
    placeholder="Email address…"
    type="email"
    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
              <button
    onClick={addUser}
    className="px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {autoUsers.map((u) => <div key={u} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                  <span className="text-sm" style={{ color: BS_BLACK }}>{u}</span>
                  <button
    onClick={() => setAutoUsers((p) => p.filter((x) => x !== u))}
    className="text-xs px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
    style={{ color: BS_MAROON }}
  >
                    Remove
                  </button>
                </div>)}
              {autoUsers.length === 0 && <p className="text-xs py-2" style={{ color: BS_GRAY }}>No individuals added yet.</p>}
            </div>
          </div>
        </div>
      </div>


    </div>;
}
function AdminProfileContent({
  user,
  profilePic,
  setProfilePic
}) {
  const picRef = useRef(null);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saved, setSaved] = useState(false);
  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target?.result);
    reader.readAsDataURL(file);
  };
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return <div className="w-full space-y-6">
      <div>
        <h2 className="text-base" style={{ color: BS_BLACK, fontWeight: 600 }}>My Profile</h2>
        <p className="text-sm mt-0.5" style={{ color: BS_GRAY }}>Manage your personal information and avatar.</p>
      </div>

      {
    /* Avatar card */
  }
      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <h3 className="text-sm mb-5" style={{ color: BS_BLACK, fontWeight: 600 }}>Profile Picture</h3>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div
    className="h-24 w-24 rounded-full flex items-center justify-center overflow-hidden"
    style={{ backgroundColor: BS_GOLD }}
  >
              {profilePic ? <img src={profilePic} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-3xl" style={{ color: BS_BLACK, fontWeight: 700 }}>{user?.name?.charAt(0)}</span>}
            </div>
            <button
    onClick={() => picRef.current?.click()}
    className="absolute bottom-0 right-0 h-7 w-7 rounded-full flex items-center justify-center shadow-md hover:opacity-80 transition-opacity"
    style={{ backgroundColor: BS_BLACK }}
  >
              <Camera size={13} color="#fff" />
            </button>
            <input ref={picRef} type="file" accept="image/*" className="hidden" onChange={handlePicChange} />
          </div>
          <div>
            <p className="text-sm" style={{ color: BS_BLACK, fontWeight: 500 }}>{user?.name}</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: BS_GRAY }}>Administrator</p>
            <div className="flex gap-2">
              <button
    onClick={() => picRef.current?.click()}
    className="px-4 py-2 rounded-lg text-xs hover:opacity-90 transition-opacity"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
                Upload Photo
              </button>
              {profilePic && <button
    onClick={() => setProfilePic(null)}
    className="px-4 py-2 rounded-lg text-xs border hover:opacity-80 transition-opacity"
    style={{ borderColor: "#E5E7EB", color: BS_GRAY }}
  >
                  Remove
                </button>}
            </div>
          </div>
        </div>
      </div>

      {
    /* Personal info */
  }
      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <h3 className="text-sm mb-5" style={{ color: BS_BLACK, fontWeight: 600 }}>Personal Information</h3>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Full Name</label>
            <input
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Email Address</label>
            <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Role</label>
            <input
    type="text"
    value="Administrator"
    readOnly
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm"
    style={{ color: BS_GRAY }}
  />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Department</label>
            <input
    type="text"
    defaultValue="Document Management"
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
    onClick={handleSave}
    className="px-5 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
            Save Changes
          </button>
          {saved && <span className="text-xs" style={{ color: "#22C55E" }}>Changes saved successfully.</span>}
        </div>
      </div>

    </div>;
}
export {
  AdminDashboard as default
};

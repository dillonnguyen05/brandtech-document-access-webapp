import { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
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
  Download,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  Users,
  Files,
  Clock,
  Camera,
  UserCircle,
  Pencil,
  Trash2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import DocumentPreviewModal from "../components/DocumentPreviewModal";
import logo from "../imports/brandtech.jpg";
import {
  deleteDocument,
  downloadDocument,
  loadAdminDocuments,
  updateDocument,
  uploadDocument
} from "../services/documentService.js";
import { loadAuditLog } from "../services/auditService.js";
import {
  approveAccessRequest,
  denyAccessRequest,
  grantAccessRequest,
  listenToAccessRequests,
  revokeAccessRequest
} from "../services/requestService.js";
import {
  approveCustomer,
  denyCustomer,
  loadPendingCustomers,
  listenToActiveCustomers
} from "../services/userService.js";
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
    revoked: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Revoked" },
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
  const date = typeof value.toDate === "function"
    ? value.toDate()
    : value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
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
  const [requests, setRequests] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [userApprovalError, setUserApprovalError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [updatingUserAction, setUpdatingUserAction] = useState("");
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("PDF");
  const [uploadCategory, setUploadCategory] = useState("Safety");
  const [uploadTargetType, setUploadTargetType] = useState("all");
  const [uploadTargetCompany, setUploadTargetCompany] = useState("");
  const [uploadTargetCustomerId, setUploadTargetCustomerId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [documentLoadError, setDocumentLoadError] = useState("");
  const [documentActionError, setDocumentActionError] = useState("");
  const [requestLoadError, setRequestLoadError] = useState("");
  const [auditLoadError, setAuditLoadError] = useState("");
  const [activeCustomers, setActiveCustomers] = useState([]);
  const [activeCustomerError, setActiveCustomerError] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);
  const fileRef = useRef(null);
  const activeCompanies = Array.from(
    new Set(activeCustomers.map((customer) => customer.company).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const selectedTargetCustomer = activeCustomers.find((customer) => customer.id === uploadTargetCustomerId);
  const refreshDocuments = useCallback(async () => {
    try {
      const apiDocuments = await loadAdminDocuments();
      setDocuments(apiDocuments);
      setDocumentLoadError("");
    } catch (error) {
      console.error(error);
      setDocumentLoadError(error.message || "Unable to load uploaded documents.");
    }
  }, []);
  const refreshAuditLog = useCallback(async () => {
    try {
      const apiAuditLog = await loadAuditLog();
      setAuditLog(apiAuditLog);
      setAuditLoadError("");
    } catch (error) {
      console.error(error);
      setAuditLoadError(error.message || "Unable to load the audit log.");
    }
  }, []);
  const refreshPendingUsers = useCallback(async () => {
    try {
      const customers = await loadPendingCustomers();
      setPendingUsers(customers);
      setUserApprovalError("");
    } catch (error) {
      console.error(error);
      setUserApprovalError(error.message || "Unable to load pending users.");
    }
  }, []);
  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const uniqueCustomers = new Set(requests.map((r) => r.customerId)).size;
  useEffect(() => {
    let active = true;

    const loadPendingUsers = () => {
      loadPendingCustomers()
        .then((customers) => {
          if (!active) return;
          setPendingUsers(customers);
          setUserApprovalError("");
        })
        .catch((error) => {
          if (!active) return;
          console.error(error);
          setUserApprovalError(error.message || "Unable to load pending users.");
        });
    };

    loadPendingUsers();
    const intervalId = window.setInterval(loadPendingUsers, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    let active = true;

    loadAdminDocuments()
      .then((apiDocuments) => {
        if (!active) return;
        setDocuments(apiDocuments);
        setDocumentLoadError("");
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setDocumentLoadError(error.message || "Unable to load uploaded documents.");
        }
      });

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;

    loadAuditLog()
      .then((apiAuditLog) => {
        if (!active) return;
        setAuditLog(apiAuditLog);
        setAuditLoadError("");
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setAuditLoadError(error.message || "Unable to load the audit log.");
        }
      });

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const unsubscribe = listenToAccessRequests(
      (firestoreRequests) => {
        setRequests(firestoreRequests);
        setRequestLoadError("");
      },
      (error) => {
        console.error(error);
        setRequestLoadError("Unable to load access requests.");
      }
    );

    return unsubscribe;
  }, []);
  useEffect(() => {
    const unsubscribe = listenToActiveCustomers(
      (customers) => {
        setActiveCustomers(customers);
        setActiveCustomerError("");
      },
      (error) => {
        console.error(error);
        setActiveCustomerError("Unable to load active customers.");
      }
    );

    return unsubscribe;
  }, []);
  const approveRequest = async (id) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    try {
      setRequestLoadError("");
      await approveAccessRequest(id);
      await refreshAuditLog();
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to approve request.");
    }
  };
  const denyRequest = async (id) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    try {
      setRequestLoadError("");
      await denyAccessRequest(id);
      await refreshAuditLog();
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to deny request.");
    }
  };
  const grantAccess = async (requestId) => {
    const auditEntry = auditLog.find((a) => a.requestId === requestId && (a.action === "Access Denied" || a.action === "Access Revoked"));
    if (!auditEntry) return;
    try {
      setRequestLoadError("");
      await grantAccessRequest(requestId);
      await refreshAuditLog();
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to grant document access.");
    }
  };
  const revokeAccess = async (requestId) => {
    const entry = auditLog.find((a) => a.requestId === requestId);
    if (!entry) return;
    try {
      setRequestLoadError("");
      await revokeAccessRequest(requestId);
      await refreshAuditLog();
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to revoke document access.");
    }
  };
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadTitle) return;
    if (!uploadFile) {
      setUploadError("Please select a file.");
      return;
    }
    if (uploadTargetType === "company" && !uploadTargetCompany) {
      setUploadError("Select a target company.");
      return;
    }
    if (uploadTargetType === "customer" && !uploadTargetCustomerId) {
      setUploadError("Select a target customer.");
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
          targetType: uploadTargetType,
          targetCustomer: uploadTargetType === "all"
            ? "All Customers"
            : uploadTargetType === "company"
              ? uploadTargetCompany
              : selectedTargetCustomer?.name || "Specific Customer",
          targetCompany: uploadTargetType === "company" ? uploadTargetCompany : "",
          targetCustomerId: uploadTargetType === "customer" ? uploadTargetCustomerId : "",
          targetCustomerName: uploadTargetType === "customer" ? selectedTargetCustomer?.name || "" : "",
          targetCustomerEmail: uploadTargetType === "customer" ? selectedTargetCustomer?.email || "" : ""
        },
        setUploadProgress
      );

      setUploadDone(true);
      setUploadTitle("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await Promise.all([
        refreshDocuments(),
        refreshAuditLog()
      ]);
      setTimeout(() => setUploadDone(false), 3e3);
    } catch (error) {
      console.error(error);
      setUploadError(error.message || "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  };
  const handleDownloadDocument = async (document) => {
    setDocumentActionError("");

    try {
      await downloadDocument(document);
    } catch (error) {
      console.error(error);
      setDocumentActionError(error.message || "Unable to download document.");
    }
  };
  const handleUpdateDocument = async (documentId, documentData) => {
    setDocumentActionError("");

    try {
      await updateDocument(documentId, documentData);
      setEditingDocument(null);
      await Promise.all([
        refreshDocuments(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setDocumentActionError(error.message || "Unable to update document.");
      throw error;
    }
  };
  const handleDeleteDocument = async (document) => {
    const confirmed = window.confirm(
      `Delete "${document.title}"? This also removes its requests and notifications.`
    );

    if (!confirmed) return;

    setDocumentActionError("");

    try {
      await deleteDocument(document.id);
      if (previewDocument?.id === document.id) {
        setPreviewDocument(null);
      }
      await Promise.all([
        refreshDocuments(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setDocumentActionError(error.message || "Unable to delete document.");
    }
  };
  const approveUser = async (userId) => {
    setUpdatingUserId(userId);
    setUpdatingUserAction("approve");
    setUserApprovalError("");
    try {
      await approveCustomer(userId);
      setPendingUsers((currentUsers) => (
        currentUsers.filter((pendingUser) => pendingUser.id !== userId)
      ));
      await Promise.all([
        refreshPendingUsers(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setUserApprovalError(error.message || "Unable to approve user.");
    } finally {
      setUpdatingUserId("");
      setUpdatingUserAction("");
    }
  };
  const denyUser = async (userId) => {
    setUpdatingUserId(userId);
    setUpdatingUserAction("deny");
    setUserApprovalError("");
    try {
      await denyCustomer(userId);
      setPendingUsers((currentUsers) => (
        currentUsers.filter((pendingUser) => pendingUser.id !== userId)
      ));
      await Promise.all([
        refreshPendingUsers(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setUserApprovalError(error.message || "Unable to deny user.");
    } finally {
      setUpdatingUserId("");
      setUpdatingUserAction("");
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
    uploadTargetType={uploadTargetType}
    setUploadTargetType={setUploadTargetType}
    uploadTargetCompany={uploadTargetCompany}
    setUploadTargetCompany={setUploadTargetCompany}
    uploadTargetCustomerId={uploadTargetCustomerId}
    setUploadTargetCustomerId={setUploadTargetCustomerId}
    activeCustomers={activeCustomers}
    activeCompanies={activeCompanies}
    activeCustomerError={activeCustomerError}
    uploadFile={uploadFile}
    setUploadFile={setUploadFile}
    uploadProgress={uploadProgress}
    uploading={uploading}
    uploadDone={uploadDone}
    uploadError={uploadError}
    documentLoadError={documentLoadError}
    documentActionError={documentActionError}
    onPreviewDocument={setPreviewDocument}
    onDownloadDocument={handleDownloadDocument}
    onEditDocument={setEditingDocument}
    onDeleteDocument={handleDeleteDocument}
    fileRef={fileRef}
    onUpload={handleUpload}
  />}
          {section === "requests" && <RequestsContent requests={requests} error={requestLoadError} onApprove={approveRequest} onDeny={denyRequest} />}
          {section === "users" && <UserApprovalsContent
    pendingUsers={pendingUsers}
    error={userApprovalError}
    updatingUserId={updatingUserId}
    updatingUserAction={updatingUserAction}
    onApprove={approveUser}
    onDeny={denyUser}
  />}
          {section === "audit" && <AuditContent auditLog={auditLog} error={auditLoadError} onRevoke={revokeAccess} onGrant={grantAccess} requests={requests} />}
          {section === "settings" && <SettingsContent user={user} />}
          {section === "profile" && <AdminProfileContent user={user} profilePic={profilePic} setProfilePic={setProfilePic} />}
        </main>
      </div>
      <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      {editingDocument && <DocumentEditModal
    key={editingDocument.id}
    document={editingDocument}
    activeCustomers={activeCustomers}
    activeCompanies={activeCompanies}
    onClose={() => setEditingDocument(null)}
    onSave={handleUpdateDocument}
  />}
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
  uploadTargetType,
  setUploadTargetType,
  uploadTargetCompany,
  setUploadTargetCompany,
  uploadTargetCustomerId,
  setUploadTargetCustomerId,
  activeCustomers,
  activeCompanies,
  activeCustomerError,
  uploadFile,
  setUploadFile,
  uploadProgress,
  uploading,
  uploadDone,
  uploadError,
  documentLoadError,
  documentActionError,
  onPreviewDocument,
  onDownloadDocument,
  onEditDocument,
  onDeleteDocument,
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
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Target Audience</label>
            <select
    value={uploadTargetType}
    onChange={(e) => {
      setUploadTargetType(e.target.value);
      setUploadTargetCompany("");
      setUploadTargetCustomerId("");
    }}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
              <option value="all">All active customers</option>
              <option value="company">Specific company</option>
              <option value="customer">Specific customer</option>
            </select>
          </div>
          {uploadTargetType === "company" && <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Target Company</label>
              <select
    value={uploadTargetCompany}
    onChange={(e) => setUploadTargetCompany(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    required
  >
                <option value="">Select an approved company</option>
                {activeCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                Companies come from approved customer accounts.
              </p>
            </div>}
          {uploadTargetType === "customer" && <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Target Customer</label>
              <select
    value={uploadTargetCustomerId}
    onChange={(e) => setUploadTargetCustomerId(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    required
  >
                <option value="">Select an approved customer</option>
                {activeCustomers.map((customer) => <option key={customer.id} value={customer.id}>
                    {customer.name || customer.email} {customer.company ? `— ${customer.company}` : ""}
                  </option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                Customers must be approved before they appear here.
              </p>
            </div>}
          {activeCustomerError && <div className="md:col-span-2 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
              {activeCustomerError}
            </div>}
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
        {documentActionError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
            {documentActionError}
          </div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA" }}>
                {["Title", "Category", "Type", "Target", "Date", "Size", "Uploaded By", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
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
	                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_BLACK }}>{doc.targetLabel || doc.targetCustomer || "All Customers"}</td>
	                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.uploadedDate}</td>
	                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.size}</td>
	                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.uploadedBy}</td>
	                  <td className="px-4 py-3.5">
	                    <div className="flex items-center gap-2">
	                      <button
	    type="button"
	    onClick={() => onPreviewDocument(doc)}
	    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
	    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
	  >
	                        <Eye size={11} /> Preview
	                      </button>
		                      <button
		    type="button"
		    onClick={() => onDownloadDocument(doc)}
		    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
		    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
		  >
		                        <Download size={11} /> Download
		                      </button>
		                      <button
		    type="button"
		    onClick={() => onEditDocument(doc)}
		    className="h-7 w-7 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
		    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
		    aria-label={`Edit ${doc.title}`}
		    title="Edit document"
		  >
		                        <Pencil size={12} />
		                      </button>
		                      <button
		    type="button"
		    onClick={() => onDeleteDocument(doc)}
		    className="h-7 w-7 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
		    style={{ borderColor: BS_MAROON, color: BS_MAROON }}
		    aria-label={`Delete ${doc.title}`}
		    title="Delete document"
		  >
		                        <Trash2 size={12} />
		                      </button>
		                    </div>
	                  </td>
	                </tr>)}
	            </tbody>
	          </table>
        </div>
      </div>
    </div>;
}
function RequestsContent({ requests, error, onApprove, onDeny }) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>All Access Requests</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Manage customer document access requests</p>
      </div>
      {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>}
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
  updatingUserAction,
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
                  {isUpdating ? <span
    className="inline-flex items-center gap-1.5 text-xs"
    style={{ color: BS_GRAY, fontWeight: 500 }}
  >
                      <Clock size={12} />
                      {updatingUserAction === "deny" ? "Denying..." : "Approving..."}
                    </span> : <div className="flex items-center gap-2">
                    <button
          onClick={() => onApprove(pendingUser.id)}
          disabled={!pendingUser.emailVerified}
          title={pendingUser.emailVerified
            ? "Approve customer"
            : "Email verification is required before approval"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
        >
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
          onClick={() => onDeny(pendingUser.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 border disabled:opacity-50"
          style={{ borderColor: BS_MAROON, color: BS_MAROON }}
        >
                      <XCircle size={12} /> Deny
                    </button>
                  </div>}
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
function AuditContent({ auditLog, error, onRevoke, onGrant, requests }) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Audit Log</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Complete record of all document access actions</p>
      </div>
      {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>}
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
    const canGrant = (req?.status === "denied" && entry.action === "Access Denied")
      || (req?.status === "revoked" && entry.action === "Access Revoked");
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
            {auditLog.length === 0 && <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                  No audit activity yet.
                </td>
              </tr>}
          </tbody>
        </table>
      </div>
    </div>;
}
function DocumentEditModal({
  document,
  activeCustomers,
  activeCompanies,
  onClose,
  onSave
}) {
  const [form, setForm] = useState({
    title: document.title || "",
    type: document.type || "Other",
    category: document.category || "Other",
    targetType: document.targetType || "all",
    targetCompany: document.targetCompany || "",
    targetCustomerId: document.targetCustomerId || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (event) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value
    }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave(document.id, form);
    } catch (saveError) {
      setError(saveError.message || "Unable to update document.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-lg bg-white border border-gray-100 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Edit Document</h3>
            <p className="text-xs mt-0.5 truncate max-w-sm" style={{ color: BS_GRAY }}>{document.fileName}</p>
          </div>
          <button
    type="button"
    onClick={onClose}
    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
    aria-label="Close edit document"
  >
            <XCircle size={16} style={{ color: BS_GRAY }} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Title</label>
            <input
    value={form.title}
    onChange={update("title")}
    required
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
  />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Type</label>
            <select value={form.type} onChange={update("type")} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              {["PDF", "Word", "Excel", "PowerPoint", "Other"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Category</label>
            <select value={form.category} onChange={update("category")} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              {["Safety", "Technical", "Compliance", "Operations", "Legal", "Other"].map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Target Audience</label>
            <select
    value={form.targetType}
    onChange={(event) => setForm((previous) => ({
      ...previous,
      targetType: event.target.value,
      targetCompany: "",
      targetCustomerId: ""
    }))}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm"
  >
              <option value="all">All active customers</option>
              <option value="company">Specific company</option>
              <option value="customer">Specific customer</option>
            </select>
          </div>
          {form.targetType === "company" && <div className="sm:col-span-2">
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Company</label>
              <select value={form.targetCompany} onChange={update("targetCompany")} required className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                <option value="">Select company</option>
                {activeCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </div>}
          {form.targetType === "customer" && <div className="sm:col-span-2">
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Customer</label>
              <select value={form.targetCustomerId} onChange={update("targetCustomerId")} required className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                <option value="">Select customer</option>
                {activeCustomers.map((customer) => <option key={customer.id} value={customer.id}>
                    {customer.name || customer.email} {customer.company ? `— ${customer.company}` : ""}
                  </option>)}
              </select>
            </div>}
          {error && <div className="sm:col-span-2 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
              {error}
            </div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm" style={{ color: BS_GRAY }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm disabled:opacity-50" style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
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

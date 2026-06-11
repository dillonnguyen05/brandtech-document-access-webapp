import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Bell,
  User,
  LogOut,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  AlertCircle,
  Camera,
  Settings,
  Trash2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import DocumentPreviewModal from "../components/DocumentPreviewModal";
import {
  downloadDocument,
  loadCustomerDocuments
} from "../services/documentService.js";
import {
  createAccessRequest,
  listenToCustomerRequests
} from "../services/requestService.js";
import {
  dismissNotification,
  listenToUserNotifications,
  markNotificationRead,
  markNotificationsRead
} from "../services/notificationService.js";
import logo from "../imports/brandtech.jpg";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_MAROON = "#8A2A2B";
const BS_GRAY = "#565A5C";
const BS_LIGHT = "#F7F8F9";
function StatusBadge({ status }) {
  const map = {
    pending: { bg: "rgba(242,169,0,0.12)", color: "#A37200", label: "Pending Review", icon: <Clock size={11} /> },
    approved: { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Approved", icon: <CheckCircle size={11} /> },
    denied: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Denied", icon: <XCircle size={11} /> }
  };
  const cfg = map[status] || { bg: "#F3F4F6", color: BS_GRAY, label: status, icon: null };
  return <span
    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs"
    style={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 500 }}
  >
      {cfg.icon}
      {cfg.label}
    </span>;
}
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "requests", label: "Requests", icon: ClipboardList },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "profile", label: "Profile", icon: User },
  { key: "settings", label: "Settings", icon: Settings }
];
function documentTargetsCustomer(document, user) {
  if (!document.targetType || document.targetType === "all") {
    return !document.targetCustomer
      || document.targetCustomer === "All Customers"
      || document.targetCustomer === user?.company;
  }

  if (document.targetType === "company") {
    return document.targetCompany === user?.company;
  }

  if (document.targetType === "customer") {
    return document.targetCustomerId === user?.id;
  }

  return false;
}
function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("dashboard");
  const [documents, setDocuments] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [documentLoadError, setDocumentLoadError] = useState("");
  const [requestLoadError, setRequestLoadError] = useState("");
  const [requestActionError, setRequestActionError] = useState("");
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const [updatingNotificationId, setUpdatingNotificationId] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const customerDocuments = documents.filter((document) => documentTargetsCustomer(document, user));
  const approvedDocIds = new Set(
    myRequests.filter((r) => r.status === "approved").map((r) => r.documentId)
  );
  const activeRequestDocIds = new Set(
    myRequests.filter((r) => r.status === "pending" || r.status === "approved").map((r) => r.documentId)
  );
  const approvedDocs = customerDocuments.filter((doc) => approvedDocIds.has(doc.id));
  const availableDocs = customerDocuments.filter((doc) => !activeRequestDocIds.has(doc.id));
  const unreadCount = notifications.filter((n) => !n.read).length;
  useEffect(() => {
    let active = true;

    loadCustomerDocuments()
      .then((apiDocuments) => {
        if (!active) return;
        setDocuments(apiDocuments);
        setDocumentLoadError("");
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setDocumentLoadError(error.message || "Unable to load documents.");
        }
      });

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user?.id) return undefined;

    const unsubscribe = listenToCustomerRequests(
      user.id,
      (firestoreRequests) => {
        setMyRequests(firestoreRequests);
        setRequestLoadError("");
      },
      (error) => {
        console.error(error);
        setRequestLoadError("Unable to load your access requests.");
      }
    );

    return unsubscribe;
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return undefined;

    const unsubscribe = listenToUserNotifications(
      user.id,
      (firestoreNotifications) => {
        setNotifications(firestoreNotifications);
        setNotificationLoadError("");
      },
      (error) => {
        console.error(error);
        setNotificationLoadError("Unable to load your notifications.");
      }
    );

    return unsubscribe;
  }, [user?.id]);
  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const requestAccess = async (document) => {
    setRequestActionError("");

    try {
      await createAccessRequest(document);
    } catch (error) {
      console.error(error);
      setRequestActionError(error.message || "Unable to request document access.");
    }
  };
  const markAllRead = async () => {
    try {
      await markNotificationsRead(notifications);
      setNotificationLoadError("");
    } catch (error) {
      console.error(error);
      setNotificationLoadError("Unable to mark notifications as read.");
    }
  };
  const markOneRead = async (notificationId) => {
    setUpdatingNotificationId(notificationId);
    setNotificationLoadError("");

    try {
      await markNotificationRead(notificationId);
      setNotifications((currentNotifications) => (
        currentNotifications.map((notification) => (
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        ))
      ));
    } catch (error) {
      console.error(error);
      setNotificationLoadError(error.message || "Unable to mark notification as read.");
    } finally {
      setUpdatingNotificationId("");
    }
  };
  const dismissOneNotification = async (notificationId) => {
    setUpdatingNotificationId(notificationId);
    setNotificationLoadError("");

    try {
      await dismissNotification(notificationId);
      setNotifications((currentNotifications) => (
        currentNotifications.filter((notification) => notification.id !== notificationId)
      ));
    } catch (error) {
      console.error(error);
      setNotificationLoadError(error.message || "Unable to dismiss notification.");
    } finally {
      setUpdatingNotificationId("");
    }
  };
  const handleDownloadDocument = async (document) => {
    setDocumentLoadError("");

    try {
      await downloadDocument(document);
    } catch (error) {
      console.error(error);
      setDocumentLoadError(error.message || "Unable to download document.");
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
    /* Nav top-anchored, profile bottom-anchored */
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
              {NAV.slice(0, 3).map(({ key, label, icon: Icon }) => {
    const active = section === key;
    return <CustNavButton
      key={key}
      label={label}
      Icon={Icon}
      active={active}
      badge={key === "notifications" && unreadCount > 0 ? unreadCount : void 0}
      badgeColor={BS_MAROON}
      onClick={() => setSection(key)}
    />;
  })}
            </div>

            {
    /* ACCOUNT group */
  }
            <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "28px 8px 20px" }} />
            <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.12em]" style={{ color: "#6A7A86", fontWeight: 700 }}>
              Account
            </p>
            <div className="space-y-0.5">
              {NAV.slice(3).map(({ key, label, icon: Icon }) => {
    const active = section === key;
    return <CustNavButton
      key={key}
      label={label}
      Icon={Icon}
      active={active}
      badge={key === "notifications" && unreadCount > 0 ? unreadCount : void 0}
      badgeColor={BS_MAROON}
      onClick={() => setSection(key)}
    />;
  })}
            </div>
          </nav>

          {
    /* Profile + Logout */
  }
          <div>
            <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "0 16px" }} />
            <div className="px-3 py-4">
              <div
    className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg mb-1"
    style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
  >
                <div
    className="h-7 w-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
    style={{ backgroundColor: "rgba(242,169,0,0.2)", color: BS_GOLD, fontWeight: 700 }}
  >
                  {user?.name?.charAt(0) || "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate" style={{ fontWeight: 500 }}>{user?.name}</p>
                  <p className="text-[10px] truncate" style={{ color: "#6A7A86" }}>{user?.company}</p>
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
      <div className="flex-1 min-w-0 overflow-y-auto">
        {
    /* Top bar */
  }
        <header
    className="sticky top-0 z-10 px-6 py-3.5 border-b flex items-center justify-between"
    style={{ backgroundColor: "#FFFFFF", borderColor: "#E9EAEC" }}
  >
          <div>
            <h2 className="text-base" style={{ color: BS_BLACK, fontWeight: 600 }}>
              {NAV.find((n) => n.key === section)?.label}
            </h2>
            <p className="text-xs" style={{ color: BS_GRAY }}>Customer Portal</p>
          </div>
          {unreadCount > 0 && <div
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer hover:opacity-80"
    style={{ backgroundColor: "rgba(138,42,43,0.08)", color: BS_MAROON }}
    onClick={() => setSection("notifications")}
  >
              <Bell size={13} />
              {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
            </div>}
        </header>

        <div className="p-6">
          {section === "dashboard" && <DashboardHome
    user={user}
    approvedDocs={approvedDocs}
    myRequests={myRequests}
    availableDocs={availableDocs}
    notifications={notifications}
    onRequestAccess={requestAccess}
    onPreviewDocument={setPreviewDocument}
    onDownloadDocument={handleDownloadDocument}
    onNavigate={setSection}
  />}
          {section === "documents" && <DocumentsSection
    approvedDocs={approvedDocs}
    documentLoadError={documentLoadError}
    onPreviewDocument={setPreviewDocument}
    onDownloadDocument={handleDownloadDocument}
  />}
          {section === "requests" && <RequestsSection
    myRequests={myRequests}
    availableDocs={availableDocs}
    requestLoadError={requestLoadError}
    requestActionError={requestActionError}
    onRequestAccess={requestAccess}
  />}
          {section === "notifications" && <NotificationsSection
    notifications={notifications}
    error={notificationLoadError}
    updatingNotificationId={updatingNotificationId}
    onMarkAllRead={markAllRead}
    onMarkRead={markOneRead}
    onDismiss={dismissOneNotification}
  />}
          {section === "profile" && <ProfileSection user={user} />}
          {section === "settings" && <CustomerSettingsContent user={user} />}
        </div>
      </div>
      <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
    </div>;
}
function CustNavButton({
  label,
  Icon,
  active,
  badge,
  badgeColor,
  onClick
}) {
  return <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all relative"
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
      <span className="text-sm" style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
      {badge !== void 0 && <span
    className="ml-auto text-xs rounded-full px-1.5 py-0.5"
    style={{ backgroundColor: badgeColor || BS_GOLD, color: "#FFFFFF", fontWeight: 600, minWidth: "20px", textAlign: "center" }}
  >
          {badge}
        </span>}
    </button>;
}
function DashboardHome({
  user,
  approvedDocs,
  myRequests,
  availableDocs,
  notifications,
  onRequestAccess,
  onPreviewDocument,
  onDownloadDocument,
  onNavigate
}) {
  const pendingCount = myRequests.filter((r) => r.status === "pending").length;
  const unreadCount = notifications.filter((n) => !n.read).length;
  return <div className="space-y-6">
      {
    /* Welcome card */
  }
      <div
    className="rounded-xl p-6 relative overflow-hidden"
    style={{ backgroundColor: BS_BLACK }}
  >
        <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
      backgroundSize: "40px 40px"
    }}
  />
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: BS_GOLD }} />
        <div className="relative z-10">
          <p className="text-sm mb-1" style={{ color: "#6B7480" }}>Welcome back,</p>
          <h1 className="text-2xl text-white mb-1" style={{ fontWeight: 600 }}>
            {user?.name}
          </h1>
          <p className="text-sm" style={{ color: "#5A6470" }}>
            {user?.company} · View approved documents and manage your access requests.
          </p>
        </div>
      </div>

      {
    /* Quick stats */
  }
      <div className="grid grid-cols-3 gap-4">
        {[
    { label: "Approved Documents", value: approvedDocs.length },
    { label: "Pending Requests", value: pendingCount },
    { label: "Notifications", value: unreadCount }
  ].map(({ label, value }) => <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs mb-2" style={{ color: BS_GRAY }}>{label}</p>
            <p className="text-3xl" style={{ color: BS_BLACK, fontWeight: 600 }}>{value}</p>
          </div>)}
      </div>

      {
    /* Approved documents preview */
  }
      {approvedDocs.length > 0 ? <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Your Approved Documents</h3>
            <button
    onClick={() => onNavigate("documents")}
    className="flex items-center gap-1 text-xs hover:underline"
    style={{ color: BS_GOLD }}
  >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {approvedDocs.slice(0, 3).map((doc, i) => <div
    key={doc.id}
    className="flex items-center justify-between px-5 py-4"
    style={{ borderBottom: i < Math.min(approvedDocs.length, 3) - 1 ? "1px solid #F3F4F6" : "none" }}
  >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
                  <FileText size={14} style={{ color: BS_GRAY }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: BS_BLACK, fontWeight: 500 }}>{doc.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>{doc.category} · {doc.uploadedDate}</p>
                </div>
              </div>
	              <div className="flex items-center gap-2">
	                <button
    onClick={() => onPreviewDocument(doc)}
	    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
	    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
	  >
	                  <ExternalLink size={11} /> Open
	                </button>
		                <button
	    type="button"
	    onClick={() => onDownloadDocument(doc)}
	    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
	    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
	  >
		                  <Download size={11} /> Download
		                </button>
	              </div>
	            </div>)}
        </div> : <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <FileText size={28} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: BS_GRAY }}>No approved documents yet.</p>
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Request access to documents below.</p>
        </div>}

      {
    /* Available docs preview */
  }
      {availableDocs.length > 0 && <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Available to Request</h3>
            <button
    onClick={() => onNavigate("requests")}
    className="flex items-center gap-1 text-xs hover:underline"
    style={{ color: BS_GOLD }}
  >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {availableDocs.slice(0, 3).map((doc, i) => <div
    key={doc.id}
    className="flex items-center justify-between px-5 py-4"
    style={{ borderBottom: i < Math.min(availableDocs.length, 3) - 1 ? "1px solid #F3F4F6" : "none" }}
  >
              <div>
                <p className="text-sm" style={{ color: BS_BLACK, fontWeight: 500 }}>{doc.title}</p>
                <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>{doc.category} · {doc.uploadedDate}</p>
	              </div>
	              <button
	    onClick={() => onRequestAccess(doc)}
	    className="px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
	    style={{ borderColor: BS_BLACK, color: BS_BLACK }}
	  >
                Request Access
              </button>
            </div>)}
        </div>}
    </div>;
}
function DocumentsSection({
  approvedDocs,
  documentLoadError,
  onPreviewDocument,
  onDownloadDocument
}) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Approved Documents</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
          {approvedDocs.length} document{approvedDocs.length !== 1 ? "s" : ""} available to you
        </p>
      </div>
      {documentLoadError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {documentLoadError}
        </div>}
      {approvedDocs.length === 0 ? <div className="p-10 text-center">
          <FileText size={32} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: BS_GRAY }}>No approved documents yet.</p>
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Request access from the Requests section.</p>
        </div> : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA" }}>
                {["Document Name", "Category", "Type", "Date", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                    {h}
                  </th>)}
              </tr>
            </thead>
            <tbody>
              {approvedDocs.map((doc, i) => <tr key={doc.id} style={{ borderBottom: i < approvedDocs.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded" style={{ backgroundColor: "#F3F4F6" }}>
                        <FileText size={13} style={{ color: BS_GRAY }} />
                      </div>
                      <span className="font-medium" style={{ color: BS_BLACK }}>{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: BS_GRAY }}>
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.type}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.uploadedDate}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status="approved" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
	                      <button
	    onClick={() => onPreviewDocument(doc)}
	    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
	    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
	  >
	                        <ExternalLink size={11} /> Open
	                      </button>
		                      <button
		    type="button"
		    onClick={() => onDownloadDocument(doc)}
		    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
		    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
		  >
		                        <Download size={11} /> Download
		                      </button>
	                    </div>
	                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>}
    </div>;
}
function RequestsSection({
  myRequests,
  availableDocs,
  requestLoadError,
  requestActionError,
  onRequestAccess
}) {
  return <div className="space-y-6">
      {
    /* Available to request */
  }
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Available Documents</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Request access to these documents</p>
        </div>
        {requestActionError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
            {requestActionError}
          </div>}
        {availableDocs.length === 0 ? <div className="p-8 text-center">
            <CheckCircle size={28} className="mx-auto mb-3" style={{ color: "#22C55E" }} />
            <p className="text-sm" style={{ color: BS_GRAY }}>You've requested all available documents.</p>
          </div> : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA" }}>
                  {["Title", "Category", "Type", "Date", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                      {h}
                    </th>)}
                </tr>
              </thead>
              <tbody>
                {availableDocs.map((doc, i) => <tr key={doc.id} style={{ borderBottom: i < availableDocs.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{doc.title}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: BS_GRAY }}>
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.type}</td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{doc.uploadedDate}</td>
	                    <td className="px-4 py-3.5">
	                      <button
	    onClick={() => onRequestAccess(doc)}
	    className="px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
	    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
	  >
                        Request Access
                      </button>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </div>

      {
    /* My requests */
  }
      <div className="bg-white rounded-xl border border-gray-100">
	        <div className="px-5 py-4 border-b border-gray-100">
	          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>My Requests</h3>
	          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Track the status of your access requests</p>
	        </div>
	        {requestLoadError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
	            {requestLoadError}
	          </div>}
	        {myRequests.length === 0 ? <div className="p-8 text-center">
            <ClipboardList size={28} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: BS_GRAY }}>No requests yet.</p>
          </div> : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA" }}>
                  {["Document", "Category", "Date Requested", "Status"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                      {h}
                    </th>)}
                </tr>
	              </thead>
	              <tbody>
	                {myRequests.map((req, i) => <tr key={req.id} style={{ borderBottom: i < myRequests.length - 1 ? "1px solid #F3F4F6" : "none" }}>
	                      <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{req.documentTitle}</td>
	                      <td className="px-4 py-3.5">
	                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: BS_GRAY }}>
	                          {req.documentCategory || "\u2014"}
	                        </span>
	                      </td>
	                      <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{req.dateRequested}</td>
	                      <td className="px-4 py-3.5">
	                        <StatusBadge status={req.status} />
	                      </td>
	                    </tr>)}
	              </tbody>
            </table>
          </div>}
      </div>
    </div>;
}
function NotificationsSection({
  notifications,
  error,
  updatingNotificationId,
  onMarkAllRead,
  onMarkRead,
  onDismiss
}) {
  const iconMap = {
    approved: <CheckCircle size={16} style={{ color: "#22C55E" }} />,
    denied: <XCircle size={16} style={{ color: BS_MAROON }} />,
    revoked: <AlertCircle size={16} style={{ color: BS_MAROON }} />,
    "account-approved": <CheckCircle size={16} style={{ color: "#22C55E" }} />
  };
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Notifications</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Updates on your account and document access requests</p>
        </div>
        {notifications.some((n) => !n.read) && <button
    onClick={onMarkAllRead}
    className="text-xs hover:underline"
    style={{ color: BS_GOLD }}
  >
            Mark all as read
          </button>}
      </div>
      {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>}
      <div>
        {notifications.length === 0 ? <div className="p-10 text-center">
            <Bell size={28} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: BS_GRAY }}>No notifications yet.</p>
          </div> : notifications.map((notif, i) => {
    const isUpdating = updatingNotificationId === notif.id;

    return <div
    key={notif.id}
    className="flex items-start gap-4 px-5 py-4"
    style={{
      borderBottom: i < notifications.length - 1 ? "1px solid #F3F4F6" : "none",
      backgroundColor: notif.read ? "transparent" : "rgba(242,169,0,0.03)"
    }}
  >
              <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: "#F3F4F6" }}>
                {iconMap[notif.type] || <Bell size={16} style={{ color: BS_GRAY }} />}
              </div>
              <div className="flex-1">
                <p className="text-sm" style={{ color: BS_BLACK, fontWeight: notif.read ? 400 : 500 }}>
                  {notif.message}
                </p>
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{notif.timestamp}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notif.read && <button
    type="button"
    onClick={() => onMarkRead(notif.id)}
    disabled={isUpdating}
    className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-40"
    style={{ color: "#166534" }}
    title="Mark as read"
    aria-label="Mark notification as read"
  >
                    <CheckCircle size={15} />
                  </button>}
                <button
    type="button"
    onClick={() => onDismiss(notif.id)}
    disabled={isUpdating}
    className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-50 disabled:opacity-40"
    style={{ color: BS_MAROON }}
    title="Dismiss notification"
    aria-label="Dismiss notification"
  >
                  <Trash2 size={15} />
                </button>
                {!notif.read && <div className="h-2 w-2 rounded-full ml-1" style={{ backgroundColor: BS_GOLD }} />}
              </div>
            </div>;
  })}
      </div>
    </div>;
}
function ProfileSection({ user }) {
  const picRef = useRef(null);
  const [profilePic, setProfilePic] = useState(null);
  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target?.result);
    reader.readAsDataURL(file);
  };
  const profileFields = [
    ["Full Name", user?.name || "—"],
    ["Email Address", user?.email || "—"],
    ["Company", user?.company || "—"],
    ["Role", "Customer"]
  ];

  return <div className="w-full space-y-6">
      <div>
        <h2 className="text-base" style={{ color: BS_BLACK, fontWeight: 600 }}>My Profile</h2>
        <p className="text-sm mt-0.5" style={{ color: BS_GRAY }}>Review your account information and manage your avatar.</p>
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
            <p className="text-xs mt-0.5 mb-3" style={{ color: BS_GRAY }}>{user?.company}</p>
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
          {profileFields.map(([label, value]) => <div key={label}>
              <p className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>{label}</p>
              <div
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm min-h-[42px] flex items-center"
    style={{ color: label === "Role" ? BS_GRAY : BS_BLACK }}
  >
                {value}
              </div>
            </div>)}
        </div>
        <div
    className="mt-5 rounded-lg border px-4 py-3"
    style={{ backgroundColor: "rgba(242,169,0,0.08)", borderColor: "rgba(242,169,0,0.24)" }}
  >
          <p className="text-xs" style={{ color: "#A37200", fontWeight: 600 }}>Notes</p>
          <p className="text-sm mt-1" style={{ color: BS_GRAY }}>
            Contact BrandTech for any changes to your name, company, or email address.
          </p>
        </div>
      </div>
    </div>;
}
function CustomerSettingsContent({ user }) {
  const [pwSaved, setPwSaved] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState("30");
  const [autoRenew, setAutoRenew] = useState(true);
  const [notifyApproval, setNotifyApproval] = useState(true);
  const [notifyDenial, setNotifyDenial] = useState(true);
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  return <div className="w-full space-y-8">
      {
    /* Header */
  }
      <div className="flex items-center gap-4">
        <div
    className="h-14 w-14 rounded-full flex items-center justify-center text-xl flex-shrink-0"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 700 }}
  >
          {user?.name?.charAt(0) || "C"}
        </div>
        <div>
          <h3 className="text-base" style={{ color: BS_BLACK, fontWeight: 600 }}>{user?.name}</h3>
          <p className="text-sm" style={{ color: BS_GRAY }}>{user?.company}</p>
        </div>
      </div>

      {
    /* ── Change Password + Access Request Preferences ── */
  }
      <div className="grid grid-cols-2 gap-8">
        {
    /* Change Password */
  }
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
    /* Access Request Preferences */
  }
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <h3 className="text-sm mb-1" style={{ color: BS_BLACK, fontWeight: 600 }}>Access Request Preferences</h3>
          <p className="text-xs mb-5" style={{ color: BS_GRAY }}>Default settings applied when you submit new document access requests.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Preferred Access Duration</label>
              <select
    value={defaultDuration}
    onChange={(e) => setDefaultDuration(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
                {[["7", "7 days"], ["14", "14 days"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: BS_GRAY }}>Pre-filled when submitting a new request.</p>
            </div>
            <div>
              <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
                <div>
                  <p className="text-sm" style={{ color: BS_BLACK }}>Auto-renew requests</p>
                  <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Automatically re-submit when access is about to expire.</p>
                </div>
                <button
    onClick={() => setAutoRenew((p) => !p)}
    className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
    style={{ backgroundColor: autoRenew ? BS_GOLD : "#D1D5DB" }}
  >
                  <span
    className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
    style={{ transform: autoRenew ? "translateX(16px)" : "translateX(0)" }}
  />
                </button>
              </label>
            </div>
            <button
    onClick={() => {
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2500);
    }}
    className="px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
              {prefSaved ? "\u2713 Saved" : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>

      {
    /* ── Notification Preferences ── */
  }
      <div className="bg-white rounded-xl border border-gray-100 p-8 w-full">
        <h3 className="text-sm mb-1" style={{ color: BS_BLACK, fontWeight: 600 }}>Notification Preferences</h3>
        <p className="text-xs mb-5" style={{ color: BS_GRAY }}>Choose which events send you an email notification.</p>
        <div className="space-y-4">
          {[
    ["notifyApproval", "Request approved", "Get notified when an access request is approved.", notifyApproval, setNotifyApproval],
    ["notifyDenial", "Request denied", "Get notified when an access request is declined.", notifyDenial, setNotifyDenial],
    ["notifyExpiry", "Access expiring soon", "Get notified 7 days before document access expires.", notifyExpiry, setNotifyExpiry]
  ].map(([key, label, desc, val, setter]) => <div key={key} className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm" style={{ color: BS_BLACK }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>{desc}</p>
              </div>
              <button
    onClick={() => setter(!val)}
    className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
    style={{ backgroundColor: val ? BS_GOLD : "#D1D5DB" }}
  >
                <span
    className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
    style={{ transform: val ? "translateX(16px)" : "translateX(0)" }}
  />
              </button>
            </div>)}
        </div>
      </div>
    </div>;
}
export {
  CustomerDashboard as default
};

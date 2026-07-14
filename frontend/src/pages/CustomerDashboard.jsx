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
  ArrowLeft,
  AlertCircle,
  Camera,
  Settings,
  Trash2,
  Folder,
  Search
} from "lucide-react";
// Function from AuthContext.jsx; checks the current logged-in customer and exposes logout.
import { useAuth } from "../context/AuthContext";
// Component from DocumentPreviewModal.jsx; checks file type and shows preview/download UI.
import DocumentPreviewModal from "../components/DocumentPreviewModal";
// Functions from documentService.js; check visible customer documents and approved downloads through Express.
import {
  downloadDocument,
  loadCustomerDocumentLibrary
} from "../services/documentService.js";
// Functions from requestService.js; check customer access request creation and request history through Express.
import {
  createAccessRequest,
  loadCustomerRequests
} from "../services/requestService.js";
// Functions from notificationService.js; check notification reads, read status, and dismiss actions through Express.
import {
  dismissNotification,
  loadUserNotifications,
  markNotificationRead,
  markNotificationsRead
} from "../services/notificationService.js";
// Functions from profileService.js; save/remove the current user's avatar through Express.
import {
  removeProfilePhoto,
  uploadProfilePhoto
} from "../services/profileService.js";
import logo from "../imports/brandtech.jpg";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_MAROON = "#8A2A2B";
const BS_GRAY = "#565A5C";
const BS_LIGHT = "#F7F8F9";
const NOTIFICATION_PREFERENCES_STORAGE_KEY = "brandtech.customer.notificationPreferences";
const DEFAULT_NOTIFICATION_PREFERENCES = {
  notifyApproval: true,
  notifyDenial: true,
  notifyExpiry: true
};

/**
 * Loads website-only notification display preferences from this browser.
 */
function loadNotificationPreferences() {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(NOTIFICATION_PREFERENCES_STORAGE_KEY) || "{}"
    );

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...stored
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/**
 * Checks whether a notification should be visible inside the website based on customer preferences.
 */
function notificationMatchesPreferences(notification, preferences) {
  const type = notification?.type || "";

  if (type === "approved") return preferences.notifyApproval;
  if (type === "denied" || type === "revoked") return preferences.notifyDenial;
  if (type === "expired" || type === "expiring" || type === "access-expired" || type === "access-expiring") {
    return preferences.notifyExpiry;
  }

  return true;
}

/**
 * Renders customer-facing status pills for document requests.
 */
function StatusBadge({ status }) {
  const map = {
    pending: { bg: "rgba(242,169,0,0.12)", color: "#A37200", label: "Pending Review", icon: <Clock size={11} /> },
    approved: { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Approved", icon: <CheckCircle size={11} /> },
    denied: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Denied", icon: <XCircle size={11} /> },
    revoked: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Revoked", icon: <AlertCircle size={11} /> },
    expired: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Expired", icon: <AlertCircle size={11} /> }
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

/**
 * Checks whether any searchable field contains the current search text.
 */
function matchesSearch(query, ...values) {
  const needle = query.trim().toLowerCase();

  if (!needle) return true;

  return values.some((value) => String(value || "").toLowerCase().includes(needle));
}

/**
 * Shared compact search input used in customer document lists.
 */
function SearchInput({ value, onChange, placeholder }) {
  return <div className="relative w-full sm:w-80">
    <Search
      size={15}
      className="absolute left-3 top-1/2 -translate-y-1/2"
      style={{ color: "#9CA3AF" }}
    />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
      style={{ color: BS_BLACK }}
    />
  </div>;
}

/**
 * Mirrors backend targeting rules so the UI only shows relevant documents.
 */
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

/**
 * Checks if a folder contains a document directly or through a subfolder.
 */
function folderContainsDocument(folder, document) {
  const folderPath = folder.path || "";
  const documentFolderPath = document.folderPath || "";

  if (!folderPath) return true;

  return documentFolderPath === folderPath
    || documentFolderPath.startsWith(`${folderPath}/`);
}

/**
 * Checks if a folder request covers this folder or one of its subfolders.
 */
function folderCoveredByRequest(folder, request) {
  const requestFolderPath = request.folderPath || "";
  const folderPath = folder.path || "";

  if (request.folderId === folder.id) return true;
  if (!requestFolderPath) return false;

  return folderPath === requestFolderPath
    || folderPath.startsWith(`${requestFolderPath}/`);
}

/**
 * Shows customers when a folder approval only shared part of the requested folder.
 */
function requestDecisionSummary(request) {
  const excludedCount = Number(request.excludedDocumentCount || 0);

  if (request.resourceType === "folder" && request.status === "approved" && excludedCount > 0) {
    const noun = excludedCount === 1 ? "item" : "items";
    return `${excludedCount} ${noun} not shared.`;
  }

  return request.decisionMessage || "—";
}

/**
 * Builds breadcrumbs for customer folder browsing.
 */
function buildFolderBreadcrumbs(folders, currentFolderId) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const breadcrumbs = [{ id: "", name: "All Documents" }];
  const trail = [];
  let folder = folderMap.get(currentFolderId);

  while (folder) {
    trail.unshift(folder);
    folder = folderMap.get(folder.parentFolderId);
  }

  return breadcrumbs.concat(trail.map((item) => ({
    id: item.id,
    name: item.name
  })));
}

/**
 * Main customer shell that loads documents, requests, notifications, and route sections.
 */
function CustomerDashboard() {
  const { user, logout, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("dashboard");
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [documentFolderId, setDocumentFolderId] = useState("");
  const [requestFolderId, setRequestFolderId] = useState("");
  const [myRequests, setMyRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState(loadNotificationPreferences);
  const [documentLoadError, setDocumentLoadError] = useState("");
  const [requestLoadError, setRequestLoadError] = useState("");
  const [requestActionError, setRequestActionError] = useState("");
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const [updatingNotificationId, setUpdatingNotificationId] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const customerDocuments = documents.filter((document) => documentTargetsCustomer(document, user));
  const folderRequests = myRequests.filter((request) => request.resourceType === "folder");
  const activeFolderRequests = folderRequests.filter((request) => (
    request.status === "pending" || request.status === "approved"
  ));
  const pendingFolderRequests = folderRequests.filter((request) => request.status === "pending");
  const approvedFolderRequests = folderRequests.filter((request) => request.status === "approved");
  const folderStatus = (folder) => {
    if (approvedFolderRequests.some((request) => folderCoveredByRequest(folder, request))) {
      return "approved";
    }

    if (pendingFolderRequests.some((request) => folderCoveredByRequest(folder, request))) {
      return "pending";
    }

    return "";
  };
  const requestableFolders = folders.filter((folder) => !activeFolderRequests.some((request) => (
    folderCoveredByRequest(folder, request)
  )));
  const approvedDocs = customerDocuments.filter((document) => (
    document.accessStatus === "approved" || document.approved === true
  ));
  const documentFolders = folders.filter((folder) => (
    approvedDocs.some((document) => folderContainsDocument(folder, document))
  ));
  const documentBreadcrumbs = buildFolderBreadcrumbs(documentFolders, documentFolderId);
  const requestBreadcrumbs = buildFolderBreadcrumbs(folders, requestFolderId);
  const currentDocumentFolder = documentFolders.find((folder) => folder.id === documentFolderId);
  const currentRequestFolder = folders.find((folder) => folder.id === requestFolderId);
  const visibleDocumentFolders = documentFolders.filter((folder) => (
    folder.parentFolderId === documentFolderId
  ));
  const visibleDocuments = approvedDocs.filter((document) => (
    (document.folderId || "") === documentFolderId
  ));
  const visibleRequestFolders = folders.filter((folder) => (
    folder.parentFolderId === requestFolderId
  ));
  const visibleRequestDocuments = customerDocuments.filter((document) => (
    (document.folderId || "") === requestFolderId
  ));
  const visibleNotifications = notifications.filter((notification) => (
    notificationMatchesPreferences(notification, notificationPreferences)
  ));
  const availableFolderPreview = requestableFolders.filter((folder) => (
    !folder.parentFolderId
  ));
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    let active = true;

    /**
     * Polls requestable documents, approved documents, and folders through Express.
     */
    const loadLatestDocumentLibrary = () => {
      // Function from documentService.js: loads customer-visible documents and folders from Express.
      loadCustomerDocumentLibrary()
        .then((library) => {
          if (!active) return;
          setDocuments(library.documents);
          setFolders(library.folders);
          setDocumentLoadError("");
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            setDocumentLoadError(error.message || "Unable to load documents.");
          }
        });
    };

    loadLatestDocumentLibrary();
    const intervalId = window.setInterval(loadLatestDocumentLibrary, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;

    /**
     * Polls customer request history through Express so production does not rely on client Firestore reads.
     */
    const loadLatestCustomerRequests = () => {
      // Function from requestService.js: loads this customer's access requests from Express.
      loadCustomerRequests()
        .then((apiRequests) => {
          if (!active) return;
          setMyRequests(apiRequests);
          setRequestLoadError("");
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            setRequestLoadError(error.message || "Unable to load your access requests.");
          }
        });
    };

    loadLatestCustomerRequests();
    const intervalId = window.setInterval(loadLatestCustomerRequests, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;

    /**
     * Polls notifications through Express so production does not rely on client Firestore reads.
     */
    const loadLatestNotifications = () => {
      // Function from notificationService.js: loads this customer's notifications from Express.
      loadUserNotifications()
        .then((apiNotifications) => {
          if (!active) return;
          setNotifications(apiNotifications);
          setNotificationLoadError("");
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            setNotificationLoadError(error.message || "Unable to load your notifications.");
          }
        });
    };

    loadLatestNotifications();
    const intervalId = window.setInterval(loadLatestNotifications, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id]);

  /**
   * Signs the customer out and returns to the login page.
   */
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  /**
   * Creates a new access request for the selected document or folder.
   */
  const requestAccess = async (resource) => {
    setRequestActionError("");

    try {
      // Function from requestService.js: asks Express to create a document/folder access request.
      await createAccessRequest(resource);
      // Functions from requestService.js/documentService.js: reload request history and folder library immediately.
      const [apiRequests, library] = await Promise.all([
        loadCustomerRequests(),
        loadCustomerDocumentLibrary()
      ]);
      setMyRequests(apiRequests);
      setDocuments(library.documents);
      setFolders(library.folders);
      setSection("requests");
      setRequestLoadError("");
    } catch (error) {
      console.error(error);
      setRequestActionError(error.message || "Unable to request access.");
      setSection("requests");
    }
  };

  /**
   * Marks every notification as read through Express.
   */
  const markAllRead = async () => {
    try {
      // Function from notificationService.js: asks Express to mark all notifications as read.
      await markNotificationsRead(visibleNotifications);
      const visibleNotificationIds = new Set(
        visibleNotifications.map((notification) => notification.id)
      );
      setNotifications((currentNotifications) => (
        currentNotifications.map((notification) => (
          visibleNotificationIds.has(notification.id)
            ? { ...notification, read: true }
            : notification
        ))
      ));
      setNotificationLoadError("");
    } catch (error) {
      console.error(error);
      setNotificationLoadError("Unable to mark notifications as read.");
    }
  };

  /**
   * Marks a single notification as read and updates local UI state.
   */
  const markOneRead = async (notificationId) => {
    setUpdatingNotificationId(notificationId);
    setNotificationLoadError("");

    try {
      // Function from notificationService.js: asks Express to mark one notification as read.
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

  /**
   * Deletes one notification from the customer's list.
   */
  const dismissOneNotification = async (notificationId) => {
    setUpdatingNotificationId(notificationId);
    setNotificationLoadError("");

    try {
      // Function from notificationService.js: asks Express to delete one notification.
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

  /**
   * Saves website-only notification preferences in this browser and immediately filters the UI.
   */
  const updateNotificationPreference = (key, value) => {
    setNotificationPreferences((currentPreferences) => {
      const nextPreferences = {
        ...currentPreferences,
        [key]: value
      };

      window.localStorage.setItem(
        NOTIFICATION_PREFERENCES_STORAGE_KEY,
        JSON.stringify(nextPreferences)
      );

      return nextPreferences;
    });
  };

  /**
   * Downloads an approved document through the signed-url service.
   */
  const handleDownloadDocument = async (document) => {
    setDocumentLoadError("");

    try {
      // Function from documentService.js: asks Express for a signed document download URL.
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
          className="flex flex-col shrink-0 h-full"
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
    style={{ backgroundColor: "rgba(242,169,0,0.2)", color: BS_GOLD, fontWeight: 700, overflow: "hidden" }}
  >
                  {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="avatar" className="w-full h-full object-cover" /> : user?.name?.charAt(0) || "C"}
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
    availableFolders={availableFolderPreview}
    notifications={visibleNotifications}
    onRequestAccess={requestAccess}
    onPreviewDocument={setPreviewDocument}
    onDownloadDocument={handleDownloadDocument}
    onNavigate={setSection}
  />}
          {section === "documents" && <DocumentsSection
    approvedDocumentCount={approvedDocs.length}
    visibleDocuments={visibleDocuments}
    visibleDocumentFolders={visibleDocumentFolders}
    documentBreadcrumbs={documentBreadcrumbs}
    currentDocumentFolder={currentDocumentFolder}
    documentFolderId={documentFolderId}
    setDocumentFolderId={setDocumentFolderId}
    documentLoadError={documentLoadError}
    onPreviewDocument={setPreviewDocument}
    onDownloadDocument={handleDownloadDocument}
  />}
          {section === "requests" && <RequestsSection
    myRequests={myRequests}
    visibleRequestFolders={visibleRequestFolders}
    visibleRequestDocuments={visibleRequestDocuments}
    requestBreadcrumbs={requestBreadcrumbs}
    currentRequestFolder={currentRequestFolder}
    requestFolderId={requestFolderId}
    setRequestFolderId={setRequestFolderId}
    folderStatus={folderStatus}
    requestLoadError={requestLoadError}
    requestActionError={requestActionError}
    onRequestAccess={requestAccess}
  />}
          {section === "notifications" && <NotificationsSection
    notifications={visibleNotifications}
    error={notificationLoadError}
    updatingNotificationId={updatingNotificationId}
    onMarkAllRead={markAllRead}
    onMarkRead={markOneRead}
    onDismiss={dismissOneNotification}
  />}
          {section === "profile" && <ProfileSection
    user={user}
    onProfileUpdated={refreshUserProfile}
  />}
          {section === "settings" && <CustomerSettingsContent
    user={user}
    notificationPreferences={notificationPreferences}
    onNotificationPreferenceChange={updateNotificationPreference}
  />}
        </div>
      </div>
      <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
    </div>;
}
/**
 * Sidebar navigation item for switching customer sections.
 */
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
/**
 * Customer overview showing counts, recent requests, and latest notifications.
 */
function DashboardHome({
  user,
  approvedDocs,
  myRequests,
  availableFolders,
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
      {availableFolders.length > 0 && <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Folders Available to Request</h3>
            <button
    onClick={() => onNavigate("requests")}
    className="flex items-center gap-1 text-xs hover:underline"
    style={{ color: BS_GOLD }}
  >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {availableFolders.slice(0, 3).map((folder, i) => <div
    key={folder.id}
    className="flex items-center justify-between px-5 py-4"
    style={{ borderBottom: i < Math.min(availableFolders.length, 3) - 1 ? "1px solid #F3F4F6" : "none" }}
  >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(242,169,0,0.12)" }}>
                  <Folder size={14} style={{ color: BS_GOLD }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: BS_BLACK, fontWeight: 500 }}>{folder.path || folder.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
                    {folder.requestableDocumentCount || 0} document{folder.requestableDocumentCount === 1 ? "" : "s"} in scope
                  </p>
                </div>
	              </div>
	              <button
	    onClick={() => onRequestAccess({ ...folder, resourceType: "folder" })}
	    className="px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
	    style={{ borderColor: BS_BLACK, color: BS_BLACK }}
	  >
                Request Folder
              </button>
            </div>)}
        </div>}
    </div>;
}
/**
 * Customer document page for requesting access or opening approved files.
 */
function DocumentsSection({
  approvedDocumentCount,
  visibleDocuments,
  visibleDocumentFolders,
  documentBreadcrumbs,
  currentDocumentFolder,
  documentFolderId,
  setDocumentFolderId,
  documentLoadError,
  onPreviewDocument,
  onDownloadDocument
}) {
  const [documentSearch, setDocumentSearch] = useState("");
  const folderLocationLabel = currentDocumentFolder?.path || "All Documents";
  const parentFolderId = currentDocumentFolder?.parentFolderId || "";
  const filteredVisibleDocumentFolders = visibleDocumentFolders.filter((folder) => (
    matchesSearch(documentSearch, folder.name, folder.path)
  ));
  const filteredVisibleDocuments = visibleDocuments.filter((document) => (
    matchesSearch(
      documentSearch,
      document.title,
      document.fileName,
      document.category,
      document.type,
      document.folderPath
    )
  ));

  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>{folderLocationLabel}</h3>
            <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
              {approvedDocumentCount} approved document{approvedDocumentCount !== 1 ? "s" : ""} • {filteredVisibleDocuments.length} shown
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <SearchInput
              value={documentSearch}
              onChange={setDocumentSearch}
              placeholder="Search document name..."
            />
            {documentFolderId && <button
      type="button"
      onClick={() => setDocumentFolderId(parentFolderId)}
      className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
      style={{ borderColor: "#D1D5DB", color: BS_GRAY, fontWeight: 600 }}
    >
                <ArrowLeft size={12} />
                Back
              </button>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {documentBreadcrumbs.map((breadcrumb, index) => <div key={breadcrumb.id || "root"} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight size={12} style={{ color: "#C4C9CE" }} />}
              <button
    type="button"
    onClick={() => setDocumentFolderId(breadcrumb.id)}
    className="px-2.5 py-1 rounded-lg text-xs border transition-colors hover:bg-gray-50"
    style={{
      borderColor: breadcrumb.id === documentFolderId ? BS_GOLD : "#E5E7EB",
      color: breadcrumb.id === documentFolderId ? BS_BLACK : BS_GRAY,
      fontWeight: breadcrumb.id === documentFolderId ? 600 : 500
    }}
  >
                {breadcrumb.name}
              </button>
            </div>)}
        </div>
      </div>
      {documentLoadError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {documentLoadError}
        </div>}
      {approvedDocumentCount === 0 ? <div className="p-10 text-center">
          <FileText size={32} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: BS_GRAY }}>No approved documents yet.</p>
          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Request access from the Requests tab.</p>
        </div> : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA" }}>
                {["Name", "Category", "Type", "Date", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                    {h}
                  </th>)}
              </tr>
            </thead>
            <tbody>
              {filteredVisibleDocumentFolders.map((folder) => <tr key={`folder-${folder.id}`} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td className="px-4 py-3.5">
                    <button
    type="button"
    onClick={() => setDocumentFolderId(folder.id)}
    className="inline-flex items-center gap-3 text-left hover:opacity-80"
    style={{ color: BS_BLACK, fontWeight: 600 }}
  >
                      <Folder size={15} style={{ color: BS_GOLD }} />
                      {folder.name}
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200" }}>
                      Folder
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>—</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{folder.createdDate}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status="approved" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
    type="button"
    onClick={() => setDocumentFolderId(folder.id)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
  >
                        Open <ChevronRight size={11} />
                      </button>
                    </div>
                  </td>
                </tr>)}
              {filteredVisibleDocuments.map((doc, i) => <tr key={doc.id} style={{ borderBottom: i < filteredVisibleDocuments.length - 1 ? "1px solid #F3F4F6" : "none" }}>
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
                    <div className="flex flex-wrap items-center gap-2">
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
              {filteredVisibleDocumentFolders.length === 0 && filteredVisibleDocuments.length === 0 && <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                    {documentSearch.trim() ? "No matching approved documents in this folder." : "No approved documents in this folder."}
                  </td>
                </tr>}
            </tbody>
          </table>
        </div>}
    </div>;
}
/**
 * Customer request-history table.
 */
function RequestsSection({
  myRequests,
  visibleRequestFolders,
  visibleRequestDocuments,
  requestBreadcrumbs,
  currentRequestFolder,
  requestFolderId,
  setRequestFolderId,
  folderStatus,
  requestLoadError,
  requestActionError,
  onRequestAccess
}) {
  const folderLocationLabel = currentRequestFolder?.path || "All Documents";
  const parentFolderId = currentRequestFolder?.parentFolderId || "";
  const requestButtonLabel = (status) => {
    if (status === "pending") return "Pending";
    if (status === "approved") return "Approved";
    if (status === "denied" || status === "revoked") return "Request Again";
    return "Request Document";
  };

  return <div className="space-y-6">
      {
    /* Available to request */
  }
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>{folderLocationLabel}</h3>
              <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
                Browse folders, subfolders, and individual documents to request access
              </p>
            </div>
            {requestFolderId && <button
    type="button"
    onClick={() => setRequestFolderId(parentFolderId)}
    className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY, fontWeight: 600 }}
  >
                <ArrowLeft size={12} />
                Back
              </button>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {requestBreadcrumbs.map((breadcrumb, index) => <div key={breadcrumb.id || "root"} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight size={12} style={{ color: "#C4C9CE" }} />}
                <button
    type="button"
    onClick={() => setRequestFolderId(breadcrumb.id)}
    className="px-2.5 py-1 rounded-lg text-xs border transition-colors hover:bg-gray-50"
    style={{
      borderColor: breadcrumb.id === requestFolderId ? BS_GOLD : "#E5E7EB",
      color: breadcrumb.id === requestFolderId ? BS_BLACK : BS_GRAY,
      fontWeight: breadcrumb.id === requestFolderId ? 600 : 500
    }}
  >
                  {breadcrumb.name}
                </button>
              </div>)}
          </div>
        </div>
        {requestActionError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
            {requestActionError}
          </div>}
        {visibleRequestFolders.length === 0 && visibleRequestDocuments.length === 0 ? <div className="p-8 text-center">
            <Folder size={28} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: BS_GRAY }}>No folders or documents are available here.</p>
          </div> : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA" }}>
                  {["Item", "Scope", "Status", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                      {h}
                    </th>)}
                </tr>
              </thead>
              <tbody>
                {visibleRequestFolders.map((folder, i) => {
                  const status = folderStatus(folder);
                  const canRequest = !status;

                  return <tr key={folder.id} style={{ borderBottom: i < visibleRequestFolders.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <td className="px-4 py-3.5">
                      <button
    type="button"
    onClick={() => setRequestFolderId(folder.id)}
    className="inline-flex items-center gap-3 text-left hover:opacity-80"
    style={{ color: BS_BLACK, fontWeight: 600 }}
  >
                        <Folder size={15} style={{ color: BS_GOLD }} />
                        {folder.name}
                      </button>
                      <p className="text-xs mt-1 ml-7" style={{ color: BS_GRAY }}>{folder.path}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>
                      {folder.requestableDocumentCount || 0} document{folder.requestableDocumentCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3.5">
                      {status ? <StatusBadge status={status} /> : <span className="text-xs" style={{ color: BS_GRAY }}>Available</span>}
                    </td>
		                    <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
    type="button"
    onClick={() => setRequestFolderId(folder.id)}
    className="px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
  >
                            Open
                          </button>
	                      <button
	    onClick={() => onRequestAccess({ ...folder, resourceType: "folder" })}
      disabled={!canRequest}
	    className="px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
	    style={{ backgroundColor: canRequest ? BS_GOLD : "#E5E7EB", color: canRequest ? BS_BLACK : BS_GRAY, fontWeight: 500 }}
	  >
                        {status === "approved" ? "Approved" : status === "pending" ? "Pending" : "Request Folder"}
	                      </button>
                        </div>
                    </td>
                  </tr>;
                })}
                {visibleRequestDocuments.map((document, i) => {
                  const status = document.accessStatus || (document.approved ? "approved" : "");
                  const canRequest = status !== "approved" && status !== "pending";
                  const showBorder = i < visibleRequestDocuments.length - 1;

                  return <tr key={document.id} style={{ borderBottom: showBorder ? "1px solid #F3F4F6" : "none" }}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <FileText size={15} style={{ color: BS_GRAY }} />
                        <div>
                          <p className="font-medium" style={{ color: BS_BLACK }}>{document.title}</p>
                          <p className="text-xs mt-1" style={{ color: BS_GRAY }}>
                            {document.category} · {document.uploadedDate}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>
                      Individual document
                    </td>
                    <td className="px-4 py-3.5">
                      {status ? <StatusBadge status={status} /> : <span className="text-xs" style={{ color: BS_GRAY }}>Available</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
    type="button"
    onClick={() => onRequestAccess(document)}
    disabled={!canRequest}
    className="px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
    style={{ backgroundColor: canRequest ? BS_GOLD : "#E5E7EB", color: canRequest ? BS_BLACK : BS_GRAY, fontWeight: 500 }}
  >
                        {requestButtonLabel(status)}
                      </button>
                    </td>
                  </tr>;
                })}
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
                  {["Item", "Type", "Date Requested", "Status", "Decision Message"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                      {h}
                    </th>)}
                </tr>
	              </thead>
	              <tbody>
	                {myRequests.map((req, i) => <tr key={req.id} style={{ borderBottom: i < myRequests.length - 1 ? "1px solid #F3F4F6" : "none" }}>
	                      <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{req.documentTitle}</td>
	                      <td className="px-4 py-3.5">
	                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: BS_GRAY }}>
	                          {req.resourceType === "folder" ? "Folder" : req.documentCategory || "\u2014"}
	                        </span>
	                      </td>
	                      <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{req.dateRequested}</td>
		                      <td className="px-4 py-3.5">
		                        <StatusBadge status={req.status} />
		                      </td>
                          <td className="px-4 py-3.5 text-xs max-w-[280px]" style={{ color: BS_GRAY }}>
                            {requestDecisionSummary(req)}
                          </td>
	                    </tr>)}
	              </tbody>
            </table>
          </div>}
      </div>
    </div>;
}
/**
 * Customer notifications screen with read and dismiss actions.
 */
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
/**
 * Customer profile screen with read-only account/company information.
 */
function ProfileSection({ user, onProfileUpdated }) {
  const picRef = useRef(null);
  const [profilePic, setProfilePic] = useState(user?.profilePhotoUrl || null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");

  useEffect(() => {
    setProfilePic(user?.profilePhotoUrl || null);
  }, [user?.profilePhotoUrl]);

  /**
   * Function from profileService.js; uploads the selected image through Express and refreshes AuthContext.
   */
  const handlePicChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previousPhoto = profilePic;
    const previewUrl = URL.createObjectURL(file);

    setProfilePic(previewUrl);
    setPhotoSaving(true);
    setPhotoError("");
    setPhotoMessage("");

    try {
      const updatedUser = await uploadProfilePhoto(file);
      setProfilePic(updatedUser.profilePhotoUrl || null);
      await onProfileUpdated?.();
      setPhotoMessage("Profile photo saved.");
    } catch (error) {
      console.error(error);
      setProfilePic(previousPhoto);
      setPhotoError(error.message || "Unable to save profile photo.");
    } finally {
      URL.revokeObjectURL(previewUrl);
      e.target.value = "";
      setPhotoSaving(false);
    }
  };

  /**
   * Function from profileService.js; removes the saved image through Express and refreshes AuthContext.
   */
  const handleRemovePhoto = async () => {
    const previousPhoto = profilePic;

    setPhotoSaving(true);
    setPhotoError("");
    setPhotoMessage("");

    try {
      const updatedUser = await removeProfilePhoto();
      setProfilePic(updatedUser.profilePhotoUrl || null);
      await onProfileUpdated?.();
      setPhotoMessage("Profile photo removed.");
    } catch (error) {
      console.error(error);
      setProfilePic(previousPhoto);
      setPhotoError(error.message || "Unable to remove profile photo.");
    } finally {
      setPhotoSaving(false);
    }
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
    disabled={photoSaving}
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
    disabled={photoSaving}
    className="px-4 py-2 rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
                {photoSaving ? "Saving..." : "Upload Photo"}
              </button>
              {profilePic && <button
    onClick={handleRemovePhoto}
    disabled={photoSaving}
    className="px-4 py-2 rounded-lg text-xs border hover:opacity-80 transition-opacity disabled:opacity-50"
    style={{ borderColor: "#E5E7EB", color: BS_GRAY }}
  >
                  Remove
                </button>}
            </div>
            {photoError && <p className="text-xs mt-3 text-red-700">{photoError}</p>}
            {photoMessage && <p className="text-xs mt-3 text-green-700">{photoMessage}</p>}
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
/**
 * Customer settings page for security preferences and contact notes.
 */
function CustomerSettingsContent({
  user,
  notificationPreferences,
  onNotificationPreferenceChange
}) {
  const { changePassword } = useAuth();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  /**
   * Stores password form changes before Firebase receives the update request.
   */
  const updatePasswordForm = (field) => (event) => {
    setPasswordForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value
    }));
    setPasswordError("");
    setPasswordMessage("");
  };

  /**
   * Function from AuthContext.jsx; checks current password, re-authenticates Firebase Auth, then saves the new password.
   */
  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Enter your current password and the new password twice.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordSaving(true);

    try {
      const result = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);

      if (!result.success) {
        setPasswordError(result.error || "Unable to change password.");
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setPasswordMessage("Password updated.");
    } finally {
      setPasswordSaving(false);
    }
  };

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
    /* ── Change Password + Website Notification Preferences ── */
  }
      <div className="grid grid-cols-2 gap-8">
        {
    /* Change Password */
  }
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <h3 className="text-sm mb-4" style={{ color: BS_BLACK, fontWeight: 600 }}>Change Password</h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {[
              ["currentPassword", "Current Password"],
              ["newPassword", "New Password"],
              ["confirmPassword", "Confirm New Password"]
            ].map(([field, label]) => <div key={field}>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>{label}</label>
              <input
                type="password"
                value={passwordForm[field]}
                onChange={updatePasswordForm(field)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
              />
            </div>)}
            {passwordError && <div className="px-3 py-2 rounded-lg text-xs text-red-700 bg-red-50 border border-red-100">
              {passwordError}
            </div>}
            {passwordMessage && <div className="px-3 py-2 rounded-lg text-xs text-green-700 bg-green-50 border border-green-100">
              {passwordMessage}
            </div>}
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-5 py-2.5 rounded-lg text-sm border transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: BS_BLACK, color: BS_BLACK }}
            >
              {passwordSaving ? "Saving..." : "Change Password"}
            </button>
          </form>
        </div>

        {
    /* Website Notification Preferences */
  }
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <h3 className="text-sm mb-1" style={{ color: BS_BLACK, fontWeight: 600 }}>Notification Preferences</h3>
          <p className="text-xs mb-5" style={{ color: BS_GRAY }}>Choose which in-app updates appear inside your Notifications tab.</p>
          <div className="space-y-4">
            {[
    ["notifyApproval", "Request approved", "Show a website notification when an access request is approved."],
    ["notifyDenial", "Request denied or revoked", "Show a website notification when an access request is declined or revoked."],
    ["notifyExpiry", "Access expiring soon", "Show a website notification before document access expires."]
  ].map(([key, label, desc]) => {
    const enabled = notificationPreferences[key];

    return <div key={key} className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm" style={{ color: BS_BLACK }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>{desc}</p>
                </div>
                <button
    onClick={() => onNotificationPreferenceChange(key, !enabled)}
    className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
    style={{ backgroundColor: enabled ? BS_GOLD : "#D1D5DB" }}
  >
                  <span
    className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
    style={{ transform: enabled ? "translateX(16px)" : "translateX(0)" }}
  />
                </button>
              </div>;
  })}
            <p className="text-xs pt-2" style={{ color: BS_GRAY }}>
              These settings only affect what appears inside this website. BrandTech does not send email notifications from this portal.
            </p>
          </div>
        </div>
      </div>
    </div>;
}
export {
  CustomerDashboard as default
};

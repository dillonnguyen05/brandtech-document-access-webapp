import { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  History,
  Settings,
  LogOut,
  ChevronDown,
  Upload,
  Download,
  ExternalLink,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  Users,
  ShieldCheck,
  Files,
  Clock,
  Camera,
  UserCircle,
  Pencil,
  Trash2,
  MapPin,
  Folder,
  FolderPlus,
  UploadCloud,
  ArrowLeft,
  ChevronRight,
  Search
} from "lucide-react";
// Function from AuthContext.jsx; checks the current logged-in admin and exposes logout.
import { useAuth } from "../context/AuthContext";
// Component from DocumentPreviewModal.jsx; checks file type and shows preview/download UI.
import DocumentPreviewModal from "../components/DocumentPreviewModal";
import logo from "../imports/brandtech.jpg";
// Functions from documentService.js; check document uploads, metadata edits, deletes, and downloads through Express.
import {
  createDocumentFolder,
  deleteDocument,
  deleteDocumentFolder,
  downloadDocument,
  loadAdminDocuments,
  loadDocumentFolders,
  updateDocumentFolder,
  updateDocument,
  uploadDocument,
  uploadFolder
} from "../services/documentService.js";
// Function from auditService.js; checks the Express audit-log route and returns formatted audit rows.
import { loadAuditLog } from "../services/auditService.js";
// Functions from requestService.js; check document access request actions through Express.
import {
  approveAccessRequest,
  denyAccessRequest,
  loadAccessRequests,
  revokeAccessRequest,
  updateFolderAccessExclusions
} from "../services/requestService.js";
// Functions from userService.js; check customer approval/revocation actions and active customer reads through Express.
import {
  approveCustomer,
  denyCustomer,
  loadAllUsers,
  loadActiveCustomers,
  loadPendingCustomers,
  makeUserAdmin,
  revokeCustomer,
  revokeUserAdmin
} from "../services/userService.js";
// Functions from settingsService.js; check and save admin access request defaults through Express.
import {
  loadAccessRequestDefaults,
  saveAccessRequestDefaults
} from "../services/settingsService.js";
const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_MAROON = "#8A2A2B";
const BS_GRAY = "#565A5C";
const BS_LIGHT = "#F7F8F9";

/**
 * Renders consistent status pills for requests and audit actions.
 */
function StatusBadge({ status }) {
  const map = {
    pending: { bg: "rgba(242,169,0,0.12)", color: "#A37200", label: "Pending" },
    approved: { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Approved" },
    active: { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Active" },
    denied: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Denied" },
    revoked: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Revoked" },
    expired: { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Expired" },
    "Access Granted": { bg: "rgba(34,197,94,0.12)", color: "#166534", label: "Access Granted" },
    "Access Denied": { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Access Denied" },
    "Access Revoked": { bg: "rgba(138,42,43,0.12)", color: BS_MAROON, label: "Access Revoked" },
    "Document Downloaded": { bg: "rgba(14,165,233,0.12)", color: "#0369A1", label: "Downloaded" }
  };
  const cfg = map[status] || { bg: "#F3F4F6", color: BS_GRAY, label: status };
  return <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs"
    style={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 500 }}
  >
      {cfg.label}
    </span>;
}

/**
 * Renders role pills for the owner-only all-users table.
 */
function RoleBadge({ role }) {
  const map = {
    owner: { bg: "rgba(242,169,0,0.16)", color: BS_BLACK, label: "Owner" },
    admin: { bg: "rgba(14,165,233,0.12)", color: "#0369A1", label: "Admin" },
    customer: { bg: "#F3F4F6", color: BS_GRAY, label: "Customer" }
  };
  const cfg = map[role] || { bg: "#F3F4F6", color: BS_GRAY, label: role || "Unknown" };

  return <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs"
    style={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 600 }}
  >
    {cfg.label}
  </span>;
}

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "requests", label: "Access Requests", icon: ClipboardList },
  { key: "access-management", label: "Access Management", icon: CheckCircle },
  { key: "users", label: "User Approvals", icon: Users },
  { key: "owner-users", label: "All Users", icon: ShieldCheck, ownerOnly: true },
  { key: "audit", label: "Audit Log", icon: History },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "profile", label: "Profile", icon: UserCircle }
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
 * Shared compact search input used inside admin tables.
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
 * Formats Firestore/ISO dates for compact table display.
 */
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

/**
 * Converts optional registration-location values into usable numbers.
 */
function toFiniteRegistrationNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * Checks if a registration has valid latitude and longitude.
 */
function hasRegistrationLocation(location) {
  return toFiniteRegistrationNumber(location?.latitude) !== null
    && toFiniteRegistrationNumber(location?.longitude) !== null;
}

/**
 * Creates the human-readable coordinate text shown in user approvals.
 */
function formatRegistrationLocation(location) {
  if (!hasRegistrationLocation(location)) {
    return "Location missing";
  }

  const latitude = toFiniteRegistrationNumber(location.latitude);
  const longitude = toFiniteRegistrationNumber(location.longitude);
  const accuracyValue = toFiniteRegistrationNumber(location.accuracy);
  const accuracy = accuracyValue !== null
    ? ` · ±${Math.round(accuracyValue)}m`
    : "";

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracy}`;
}

/**
 * Builds a Google Maps URL for the captured registration coordinates.
 */
function registrationLocationMapUrl(location) {
  if (!hasRegistrationLocation(location)) {
    return "";
  }

  return `https://www.google.com/maps?q=${toFiniteRegistrationNumber(location.latitude)},${toFiniteRegistrationNumber(location.longitude)}`;
}

/**
 * Builds the folder breadcrumb trail for the current document browser location.
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
 * Builds folder select options for upload/edit destinations.
 */
function buildFolderOptions(folders) {
  const sortedFolders = [...folders].sort((a, b) => (
    (a.path || a.name || "").localeCompare(b.path || b.name || "")
  ));

  return [
    { id: "", label: "All Documents" },
    ...sortedFolders.map((folder) => ({
      id: folder.id,
      label: folder.path || folder.name
    }))
  ];
}

/**
 * Checks whether an admin document sits inside a folder access request's subtree.
 */
function accessRequestContainsDocument(request, document) {
  if ((request.resourceType || "") !== "folder") return false;

  const requestFolderPath = request.folderPath || "";
  const documentFolderPath = document.folderPath || "";

  if (!requestFolderPath) return true;

  return documentFolderPath === requestFolderPath
    || documentFolderPath.startsWith(`${requestFolderPath}/`);
}

/**
 * Checks whether a document's target audience matches the folder-access customer.
 */
function documentTargetsAccessRequest(request, document) {
  if (document.active === false || document.shareEnabled === false) {
    return false;
  }

  if (!document.targetType || document.targetType === "all") {
    return true;
  }

  if (document.targetType === "company") {
    return Boolean(request.company) && document.targetCompany === request.company;
  }

  if (document.targetType === "customer") {
    return document.targetCustomerId === request.customerId;
  }

  return false;
}

/**
 * Infers the visible file type label from an uploaded file name.
 */
function inferDocumentTypeFromFileName(fileName = "") {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".pdf")) return "PDF";
  if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) return "Word";
  if (lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx")) return "Excel";
  if (lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")) return "PowerPoint";
  return "Other";
}

/**
 * Reads the browser-provided folder path for a selected upload file.
 */
function uploadRelativePath(file) {
  return (file?.webkitRelativePath || file?.name || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim();
}

/**
 * Formats selected folder-upload file sizes for the sharing review UI.
 */
function formatShareFileSize(bytes) {
  if (!bytes) return "0 KB";

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Creates a folder tree node used by the folder upload sharing selector.
 */
function createUploadFolderNode(name, folderPath) {
  return {
    id: `folder:${folderPath}`,
    type: "folder",
    name,
    path: folderPath,
    folders: [],
    files: [],
    _folderMap: new Map()
  };
}

/**
 * Sorts and removes temporary maps from upload sharing tree nodes.
 */
function finalizeUploadFolderNode(node) {
  const finalizedFolders = node.folders
    .map(finalizeUploadFolderNode)
    .sort((a, b) => a.name.localeCompare(b.name));

  const finalizedFiles = [...node.files].sort((a, b) => (
    a.name.localeCompare(b.name)
  ));

  return {
    id: node.id,
    type: node.type,
    name: node.name,
    path: node.path,
    folders: finalizedFolders,
    files: finalizedFiles
  };
}

/**
 * Builds a selectable folder/file tree from the browser FileList.
 */
function buildUploadShareTree(files) {
  const rootFolders = [];
  const rootFolderMap = new Map();

  Array.from(files || []).forEach((file) => {
    const relativePath = uploadRelativePath(file);

    if (!relativePath) return;

    const pathParts = relativePath.split("/").filter(Boolean);
    const fileName = pathParts.pop() || file.name || "Untitled file";
    const folderParts = pathParts.length > 0 ? pathParts : ["Selected Files"];
    let currentFolders = rootFolders;
    let currentFolderMap = rootFolderMap;
    let currentFolder = null;
    let folderPath = "";

    folderParts.forEach((folderName) => {
      folderPath = folderPath ? `${folderPath}/${folderName}` : folderName;

      if (!currentFolderMap.has(folderPath)) {
        const folder = createUploadFolderNode(folderName, folderPath);
        currentFolderMap.set(folderPath, folder);
        currentFolders.push(folder);
      }

      currentFolder = currentFolderMap.get(folderPath);
      currentFolders = currentFolder.folders;
      currentFolderMap = currentFolder._folderMap;
    });

    if (!currentFolder) return;

    if (!currentFolder.files.some((item) => item.path === relativePath)) {
      currentFolder.files.push({
        id: `file:${relativePath}`,
        type: "file",
        name: fileName,
        path: relativePath,
        sizeLabel: formatShareFileSize(file.size),
        typeLabel: inferDocumentTypeFromFileName(fileName)
      });
    }
  });

  return rootFolders
    .map(finalizeUploadFolderNode)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Collects every file node below a folder tree node.
 */
function collectUploadFileNodes(node) {
  return [
    ...node.files,
    ...node.folders.flatMap(collectUploadFileNodes)
  ];
}

/**
 * Flattens all file nodes in the upload sharing tree.
 */
function flattenUploadTreeFiles(tree) {
  return tree.flatMap(collectUploadFileNodes);
}

/**
 * Collects folder paths so newly selected uploads start expanded.
 */
function collectUploadFolderPaths(tree) {
  return tree.flatMap((node) => [
    node.path,
    ...collectUploadFolderPaths(node.folders)
  ]);
}

/**
 * Counts how much of a folder tree node is selected for sharing.
 */
function uploadFolderSelectionStats(node, selectedPaths) {
  const filePaths = collectUploadFileNodes(node).map((file) => file.path);
  const selectedCount = filePaths.filter((filePath) => selectedPaths.has(filePath)).length;
  const totalCount = filePaths.length;

  return {
    selectedCount,
    totalCount,
    checked: totalCount > 0 && selectedCount === totalCount,
    indeterminate: selectedCount > 0 && selectedCount < totalCount
  };
}

/**
 * Main admin shell that loads Express/Firebase data and routes between dashboard sections.
 */
function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const dropdownRef = useRef(null);
  useEffect(() => {
    /**
     * Closes the profile menu when the admin clicks outside it.
     */
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
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState("");
  const [auditLog, setAuditLog] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [userApprovalError, setUserApprovalError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [updatingUserAction, setUpdatingUserAction] = useState("");
  const [accountDecision, setAccountDecision] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Safety");
  const [uploadTargetType, setUploadTargetType] = useState("all");
  const [uploadTargetCompany, setUploadTargetCompany] = useState("");
  const [uploadTargetCustomerId, setUploadTargetCustomerId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [folderTargetType, setFolderTargetType] = useState("all");
  const [folderTargetCompany, setFolderTargetCompany] = useState("");
  const [folderTargetCustomerId, setFolderTargetCustomerId] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderUploadFiles, setFolderUploadFiles] = useState([]);
  const [folderSharePaths, setFolderSharePaths] = useState(new Set());
  const [expandedFolderSharePaths, setExpandedFolderSharePaths] = useState(new Set());
  const [folderUploading, setFolderUploading] = useState(false);
  const [folderUploadProgress, setFolderUploadProgress] = useState(0);
  const [folderUploadDone, setFolderUploadDone] = useState(false);
  const [folderUploadSummary, setFolderUploadSummary] = useState(null);
  const [folderActionError, setFolderActionError] = useState("");
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
  const [allUsers, setAllUsers] = useState([]);
  const [ownerUserError, setOwnerUserError] = useState("");
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState("");
  const [updatingRoleAction, setUpdatingRoleAction] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [accessDecision, setAccessDecision] = useState(null);
  const fileRef = useRef(null);
  const folderFileRef = useRef(null);
  const activeCompanies = Array.from(
    new Set(activeCustomers.map((customer) => customer.company).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const selectedTargetCustomer = activeCustomers.find((customer) => customer.id === uploadTargetCustomerId);
  const selectedFolderTargetCustomer = activeCustomers.find((customer) => customer.id === folderTargetCustomerId);
  const currentFolder = folders.find((folder) => folder.id === currentFolderId);
  const folderOptions = buildFolderOptions(folders);
  const folderBreadcrumbs = buildFolderBreadcrumbs(folders, currentFolderId);
  const visibleFolders = folders.filter((folder) => folder.parentFolderId === currentFolderId);
  const visibleDocuments = documents.filter((document) => (document.folderId || "") === currentFolderId);
  const isOwner = user?.role === "owner";

  /**
   * Reloads admin document metadata after upload, edit, or delete actions.
   */
  const refreshDocuments = useCallback(async () => {
    try {
      // Function from documentService.js: loads admin document metadata from Express.
      const apiDocuments = await loadAdminDocuments();
      setDocuments(apiDocuments);
      setDocumentLoadError("");
    } catch (error) {
      console.error(error);
      setDocumentLoadError(error.message || "Unable to load uploaded documents.");
    }
  }, []);

  /**
   * Reloads document folder metadata after folder creation or folder upload.
   */
  const refreshFolders = useCallback(async () => {
    try {
      // Function from documentService.js: loads folder metadata from Express.
      const apiFolders = await loadDocumentFolders();
      setFolders(apiFolders);
      setFolderActionError("");
    } catch (error) {
      console.error(error);
      setFolderActionError(error.message || "Unable to load document folders.");
    }
  }, []);

  /**
   * Reloads audit rows after actions that create audit entries.
   */
  const refreshAuditLog = useCallback(async () => {
    try {
      // Function from auditService.js: loads audit log rows from Express.
      const apiAuditLog = await loadAuditLog();
      setAuditLog(apiAuditLog);
      setAuditLoadError("");
    } catch (error) {
      console.error(error);
      setAuditLoadError(error.message || "Unable to load the audit log.");
    }
  }, []);

  /**
   * Reloads pending customer registrations from Express.
   */
  const refreshPendingUsers = useCallback(async () => {
    try {
      // Function from userService.js: loads pending customer accounts from Express.
      const customers = await loadPendingCustomers();
      setPendingUsers(customers);
      setUserApprovalError("");
    } catch (error) {
      console.error(error);
      setUserApprovalError(error.message || "Unable to load pending users.");
    }
  }, []);

  /**
   * Reloads active customers used by upload targeting and revocation controls.
   */
  const refreshActiveCustomers = useCallback(async () => {
    try {
      // Function from userService.js: loads active customers from Express.
      const customers = await loadActiveCustomers();
      setActiveCustomers(customers);
      setActiveCustomerError("");
    } catch (error) {
      console.error(error);
      setActiveCustomerError(error.message || "Unable to load active customers.");
    }
  }, []);

  /**
   * Reloads the owner-only table that lists every account and role.
   */
  const refreshAllUsers = useCallback(async () => {
    if (!isOwner) {
      setAllUsers([]);
      return;
    }

    try {
      // Function from userService.js: loads all users from the owner-only Express route.
      const users = await loadAllUsers();
      setAllUsers(users);
      setOwnerUserError("");
    } catch (error) {
      console.error(error);
      setOwnerUserError(error.message || "Unable to load all users.");
    }
  }, [isOwner]);

  /**
   * Reloads document access requests from Express.
   */
  const refreshAccessRequests = useCallback(async () => {
    try {
      // Function from requestService.js: loads admin access requests from Express.
      const apiRequests = await loadAccessRequests();
      setRequests(apiRequests);
      setRequestLoadError("");
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to load access requests.");
    }
  }, []);

  /**
   * Signs the admin out and returns to the login page.
   */
  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const activeAccessRequests = requests.filter((request) => request.status === "approved");
  const pendingCount = pendingRequests.length;
  const approvedCount = activeAccessRequests.length;
  const activeCustomerCount = activeCustomers.length;
  const pendingUserApprovalCount = pendingUsers.length;
  const getMainNavBadge = (key) => {
    if (key === "requests") return pendingCount;
    if (key === "users") return pendingUserApprovalCount;

    return void 0;
  };
  useEffect(() => {
    let active = true;

    /**
     * Polls pending users so email verification changes show without a page reload.
     */
    const loadPendingUsers = () => {
      // Function from userService.js: loads pending customer accounts from Express.
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

    Promise.all([
      // Function from documentService.js: loads admin document metadata from Express.
      loadAdminDocuments(),
      // Function from documentService.js: loads folder metadata from Express.
      loadDocumentFolders()
    ])
      .then(([apiDocuments, apiFolders]) => {
        if (!active) return;
        setDocuments(apiDocuments);
        setFolders(apiFolders);
        setDocumentLoadError("");
        setFolderActionError("");
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

    /**
     * Polls audit log updates so completed approvals and downloads appear without a full refresh.
     */
    const loadLatestAuditLog = () => {
      // Function from auditService.js: loads audit log rows from Express.
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
    };

    loadLatestAuditLog();
    const intervalId = window.setInterval(loadLatestAuditLog, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    let active = true;

    /**
     * Polls access requests through Express so the admin queue updates in production.
     */
    const loadLatestAccessRequests = () => {
      // Function from requestService.js: loads admin access requests from Express.
      loadAccessRequests()
        .then((apiRequests) => {
          if (!active) return;
          setRequests(apiRequests);
          setRequestLoadError("");
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            setRequestLoadError(error.message || "Unable to load access requests.");
          }
        });
    };

    loadLatestAccessRequests();
    const intervalId = window.setInterval(loadLatestAccessRequests, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    let active = true;

    /**
     * Polls active customers for document targeting through Express.
     */
    const loadLatestActiveCustomers = () => {
      // Function from userService.js: loads active customers from Express.
      loadActiveCustomers()
        .then((customers) => {
          if (!active) return;
          setActiveCustomers(customers);
          setActiveCustomerError("");
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            setActiveCustomerError(error.message || "Unable to load active customers.");
          }
        });
    };

    loadLatestActiveCustomers();
    const intervalId = window.setInterval(loadLatestActiveCustomers, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    if (!isOwner) {
      if (section === "owner-users") {
        setSection("dashboard");
      }
      setAllUsers([]);
      return undefined;
    }

    let active = true;

    /**
     * Polls all users through Express for owner role-management changes.
     */
    const loadLatestAllUsers = () => {
      // Function from userService.js: loads all user roles from the owner-only Express route.
      loadAllUsers()
        .then((users) => {
          if (!active) return;
          setAllUsers(users);
          setOwnerUserError("");
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            setOwnerUserError(error.message || "Unable to load all users.");
          }
        });
    };

    loadLatestAllUsers();
    const intervalId = window.setInterval(loadLatestAllUsers, 15e3);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isOwner, section]);

  /**
   * Approves a pending document request and refreshes audit history.
   */
  const approveRequest = async (id, excludedDocumentIds = []) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    try {
      setRequestLoadError("");
      // Function from requestService.js: asks Express to approve a document/folder request.
      await approveAccessRequest(id, excludedDocumentIds);
      await Promise.all([
        refreshAccessRequests(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to approve request.");
    }
  };

  /**
   * Opens the denial message modal for a document request.
   */
  const denyRequest = (request) => {
    setAccessDecision({
      request,
      type: "deny"
    });
  };

  /**
   * Opens the revocation message modal for an approved document request.
   */
  const revokeAccess = (requestId) => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;

    setAccessDecision({
      request,
      type: "revoke"
    });
  };

  /**
   * Saves nested document exclusions for an approved folder access request.
   */
  const saveFolderAccessExclusions = async (requestId, excludedDocumentIds) => {
    try {
      setRequestLoadError("");
      // Function from requestService.js: asks Express to unshare selected nested documents from a folder request.
      await updateFolderAccessExclusions(requestId, excludedDocumentIds);
      await Promise.all([
        refreshAccessRequests(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setRequestLoadError(error.message || "Unable to update folder access.");
      throw error;
    }
  };

  /**
   * Sends a denial or revocation decision message to Express.
   */
  const submitAccessDecision = async (message) => {
    if (!accessDecision) return;

    const { request, type } = accessDecision;

    try {
      setRequestLoadError("");
      if (type === "deny") {
        // Function from requestService.js: asks Express to deny a document request with a message.
        await denyAccessRequest(request.id, message);
      } else {
        // Function from requestService.js: asks Express to revoke document access with a message.
        await revokeAccessRequest(request.id, message);
      }

      setAccessDecision(null);
      await Promise.all([
        refreshAccessRequests(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setRequestLoadError(
        error.message
        || (type === "deny"
          ? "Unable to deny request."
          : "Unable to revoke document access.")
      );
      throw error;
    }
  };

  /**
   * Uploads a document file and its target metadata through the Express API.
   */
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
      // Function from documentService.js: uploads the file and metadata through Express.
      await uploadDocument(
        uploadFile,
        {
          title: uploadTitle,
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
          targetCustomerEmail: uploadTargetType === "customer" ? selectedTargetCustomer?.email || "" : "",
          folderId: currentFolderId
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

  /**
   * Creates a folder under the current document browser location.
   */
  const handleCreateFolder = async (event) => {
    event.preventDefault();

    if (!folderName.trim()) {
      setFolderActionError("Folder name is required.");
      return;
    }

    if (folderTargetType === "company" && !folderTargetCompany) {
      setFolderActionError("Select a target company for this folder.");
      return;
    }

    if (folderTargetType === "customer" && !folderTargetCustomerId) {
      setFolderActionError("Select a target customer for this folder.");
      return;
    }

    setCreatingFolder(true);
    setFolderActionError("");

    try {
      // Function from documentService.js: creates a folder through Express.
      await createDocumentFolder(
        folderName,
        currentFolderId,
        {
          targetType: folderTargetType,
          targetCompany: folderTargetType === "company" ? folderTargetCompany : "",
          targetCustomerId: folderTargetType === "customer" ? folderTargetCustomerId : "",
          targetCustomerName: folderTargetType === "customer" ? selectedFolderTargetCustomer?.name || "" : "",
          targetCustomerEmail: folderTargetType === "customer" ? selectedFolderTargetCustomer?.email || "" : ""
        }
      );
      setFolderName("");
      await Promise.all([
        refreshFolders(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setFolderActionError(error.message || "Unable to create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  /**
   * Stores selected folder-upload files and preselects every file for sharing.
   */
  const handleFolderUploadFilesChange = (files) => {
    const nextFiles = Array.from(files || []);
    const shareTree = buildUploadShareTree(nextFiles);
    const uploadFiles = flattenUploadTreeFiles(shareTree);

    setFolderUploadFiles(nextFiles);
    setFolderSharePaths(new Set(uploadFiles.map((file) => file.path)));
    setExpandedFolderSharePaths(new Set(collectUploadFolderPaths(shareTree)));
    setFolderUploadDone(false);
    setFolderUploadSummary(null);
    setFolderActionError("");
  };

  /**
   * Uploads all supported files from a selected browser folder.
   */
  const handleFolderUpload = async (event) => {
    event.preventDefault();

    if (folderUploadFiles.length === 0) {
      setFolderActionError("Please select a folder.");
      return;
    }

    if (folderSharePaths.size === 0) {
      setFolderActionError("Select at least one folder or file to share.");
      return;
    }

    if (uploadTargetType === "company" && !uploadTargetCompany) {
      setFolderActionError("Select a target company.");
      return;
    }

    if (uploadTargetType === "customer" && !uploadTargetCustomerId) {
      setFolderActionError("Select a target customer.");
      return;
    }

    setFolderUploading(true);
    setFolderUploadProgress(0);
    setFolderUploadDone(false);
    setFolderUploadSummary(null);
    setFolderActionError("");

    try {
      // Function from documentService.js: uploads a folder and creates document metadata through Express.
      const folderUploadResult = await uploadFolder(
        folderUploadFiles,
        {
          category: uploadCategory,
          targetType: uploadTargetType,
          targetCompany: uploadTargetType === "company" ? uploadTargetCompany : "",
          targetCustomerId: uploadTargetType === "customer" ? uploadTargetCustomerId : "",
          parentFolderId: currentFolderId,
          sharedFilePaths: Array.from(folderSharePaths)
        },
        setFolderUploadProgress
      );

      setFolderUploadDone(true);
      setFolderUploadSummary({
        uploadedCount: folderUploadResult.documents.length,
        sharedCount: folderUploadResult.sharedCount,
        skippedFiles: folderUploadResult.skippedFiles || []
      });
      setFolderUploadFiles([]);
      setFolderSharePaths(new Set());
      setExpandedFolderSharePaths(new Set());
      if (folderFileRef.current) folderFileRef.current.value = "";
      await Promise.all([
        refreshDocuments(),
        refreshFolders(),
        refreshAuditLog()
      ]);
      setTimeout(() => {
        setFolderUploadDone(false);
        setFolderUploadSummary(null);
      }, folderUploadResult.skippedFiles?.length ? 8e3 : 3e3);
    } catch (error) {
      console.error(error);
      setFolderActionError(error.message || "Unable to upload folder.");
    } finally {
      setFolderUploading(false);
    }
  };

  /**
   * Downloads the selected document through the signed-url service.
   */
  const handleDownloadDocument = async (document) => {
    setDocumentActionError("");

    try {
      // Function from documentService.js: asks Express for a signed document download URL.
      await downloadDocument(document);
    } catch (error) {
      console.error(error);
      setDocumentActionError(error.message || "Unable to download document.");
    }
  };

  /**
   * Saves document metadata changes and refreshes related admin tables.
   */
  const handleUpdateDocument = async (documentId, documentData) => {
    setDocumentActionError("");

    try {
      // Function from documentService.js: updates document metadata through Express.
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

  /**
   * Saves folder metadata changes and refreshes folder/document tables.
   */
  const handleUpdateFolder = async (folderId, folderData) => {
    setFolderActionError("");

    try {
      // Function from documentService.js: updates folder metadata and nested document rules through Express.
      await updateDocumentFolder(folderId, folderData);
      setEditingFolder(null);
      await Promise.all([
        refreshFolders(),
        refreshDocuments(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setFolderActionError(error.message || "Unable to update folder.");
      throw error;
    }
  };

  /**
   * Deletes a folder tree plus its nested documents through Express.
   */
  const handleDeleteFolder = async (folder) => {
    const confirmed = window.confirm(
      `Delete folder "${folder.name}" and everything inside it? This removes subfolders, documents, requests, and notifications.`
    );

    if (!confirmed) return;

    setFolderActionError("");

    try {
      // Function from documentService.js: deletes a folder tree and nested documents through Express.
      await deleteDocumentFolder(folder.id);
      if (
        currentFolderId === folder.id
        || (currentFolder?.path && folder.path && currentFolder.path.startsWith(`${folder.path}/`))
      ) {
        setCurrentFolderId(folder.parentFolderId || "");
      }
      if (editingFolder?.id === folder.id) {
        setEditingFolder(null);
      }
      await Promise.all([
        refreshFolders(),
        refreshDocuments(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setFolderActionError(error.message || "Unable to delete folder.");
    }
  };

  /**
   * Deletes a document plus related requests/notifications through Express.
   */
  const handleDeleteDocument = async (document) => {
    const confirmed = window.confirm(
      `Delete "${document.title}"? This also removes its requests and notifications.`
    );

    if (!confirmed) return;

    setDocumentActionError("");

    try {
      // Function from documentService.js: deletes the document through Express.
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

  /**
   * Approves a pending customer registration.
   */
  const approveUser = async (userId) => {
    setUpdatingUserId(userId);
    setUpdatingUserAction("approve");
    setUserApprovalError("");
    try {
      // Function from userService.js: asks Express to approve a pending customer.
      await approveCustomer(userId);
      setPendingUsers((currentUsers) => (
        currentUsers.filter((pendingUser) => pendingUser.id !== userId)
      ));
      await Promise.all([
        refreshPendingUsers(),
        refreshActiveCustomers(),
        refreshAllUsers(),
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

  /**
   * Sends a customer denial or revocation message to Express.
   */
  const submitAccountDecision = async (message) => {
    if (!accountDecision) return;

    const { customer, type } = accountDecision;
    setUpdatingUserId(customer.id);
    setUpdatingUserAction(type);
    setUserApprovalError("");

    try {
      if (type === "deny") {
        // Function from userService.js: asks Express to deny a customer account with a message.
        await denyCustomer(customer.id, message);
        setPendingUsers((currentUsers) => (
          currentUsers.filter((pendingUser) => pendingUser.id !== customer.id)
        ));
        await Promise.all([
          refreshPendingUsers(),
          refreshAllUsers()
        ]);
      } else {
        // Function from userService.js: asks Express to revoke an active customer with a message.
        await revokeCustomer(customer.id, message);
        setActiveCustomers((currentCustomers) => (
          currentCustomers.filter((activeCustomer) => activeCustomer.id !== customer.id)
        ));
        await Promise.all([
          refreshActiveCustomers(),
          refreshAllUsers()
        ]);
      }

      setAccountDecision(null);
      await refreshAuditLog();
    } catch (error) {
      console.error(error);
      setUserApprovalError(
        error.message
        || (type === "deny"
          ? "Unable to deny user."
          : "Unable to revoke customer.")
      );
      throw error;
    } finally {
      setUpdatingUserId("");
      setUpdatingUserAction("");
    }
  };

  /**
   * Promotes an active account to admin through the owner-only Express route.
   */
  const promoteToAdmin = async (targetUser) => {
    setUpdatingRoleUserId(targetUser.id);
    setUpdatingRoleAction("make-admin");
    setOwnerUserError("");

    try {
      // Function from userService.js: asks Express to grant admin access.
      await makeUserAdmin(targetUser.id);
      await Promise.all([
        refreshAllUsers(),
        refreshActiveCustomers(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setOwnerUserError(error.message || "Unable to make this user an admin.");
    } finally {
      setUpdatingRoleUserId("");
      setUpdatingRoleAction("");
    }
  };

  /**
   * Removes admin privileges through the owner-only Express route.
   */
  const removeAdminAccess = async (targetUser) => {
    setUpdatingRoleUserId(targetUser.id);
    setUpdatingRoleAction("revoke-admin");
    setOwnerUserError("");

    try {
      // Function from userService.js: asks Express to revoke admin access.
      await revokeUserAdmin(targetUser.id);
      await Promise.all([
        refreshAllUsers(),
        refreshActiveCustomers(),
        refreshAuditLog()
      ]);
    } catch (error) {
      console.error(error);
      setOwnerUserError(error.message || "Unable to revoke admin access.");
    } finally {
      setUpdatingRoleUserId("");
      setUpdatingRoleAction("");
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
              {NAV.slice(0, 6).filter((item) => !item.ownerOnly || isOwner).map(({ key, label, icon: Icon }) => {
    const active = section === key;
    return <NavButton
      key={key}
      navKey={key}
      label={label}
      Icon={Icon}
      active={active}
      badge={getMainNavBadge(key)}
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
              {NAV.slice(6, 8).map(({ key, label, icon: Icon }) => {
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
              {NAV.slice(8).map(({ key, label, icon: Icon }) => {
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
                  <p className="text-[10px] truncate" style={{ color: "#6A7A86" }}>{isOwner ? "Owner" : "Administrator"}</p>
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
            <div className="relative" ref={dropdownRef}>
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
    pendingUserApprovalCount={pendingUserApprovalCount}
    approvedCount={approvedCount}
    activeCustomerCount={activeCustomerCount}
  />}
          {section === "documents" && <DocumentsContent
    documents={documents}
    visibleDocuments={visibleDocuments}
    visibleFolders={visibleFolders}
    folderBreadcrumbs={folderBreadcrumbs}
    folderOptions={folderOptions}
    currentFolder={currentFolder}
    currentFolderId={currentFolderId}
    setCurrentFolderId={setCurrentFolderId}
    uploadTitle={uploadTitle}
    setUploadTitle={setUploadTitle}
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
    folderName={folderName}
    setFolderName={setFolderName}
    folderTargetType={folderTargetType}
    setFolderTargetType={setFolderTargetType}
    folderTargetCompany={folderTargetCompany}
    setFolderTargetCompany={setFolderTargetCompany}
    folderTargetCustomerId={folderTargetCustomerId}
    setFolderTargetCustomerId={setFolderTargetCustomerId}
    creatingFolder={creatingFolder}
    folderUploadFiles={folderUploadFiles}
    folderSharePaths={folderSharePaths}
    setFolderSharePaths={setFolderSharePaths}
    expandedFolderSharePaths={expandedFolderSharePaths}
    setExpandedFolderSharePaths={setExpandedFolderSharePaths}
    folderUploading={folderUploading}
    folderUploadProgress={folderUploadProgress}
    folderUploadDone={folderUploadDone}
    folderUploadSummary={folderUploadSummary}
    folderActionError={folderActionError}
    uploadProgress={uploadProgress}
    uploading={uploading}
    uploadDone={uploadDone}
    uploadError={uploadError}
    documentLoadError={documentLoadError}
    documentActionError={documentActionError}
    onPreviewDocument={setPreviewDocument}
    onDownloadDocument={handleDownloadDocument}
    onEditDocument={setEditingDocument}
    onEditFolder={setEditingFolder}
    onDeleteFolder={handleDeleteFolder}
    onDeleteDocument={handleDeleteDocument}
    fileRef={fileRef}
    folderFileRef={folderFileRef}
    onUpload={handleUpload}
    onCreateFolder={handleCreateFolder}
    onFolderUploadFilesChange={handleFolderUploadFilesChange}
    onUploadFolder={handleFolderUpload}
  />}
          {section === "requests" && <RequestsContent
    requests={pendingRequests}
    documents={documents}
    error={requestLoadError}
    onApprove={approveRequest}
    onDeny={denyRequest}
  />}
          {section === "access-management" && <AccessManagementContent
    approvedRequests={activeAccessRequests}
    documents={documents}
    error={requestLoadError}
    onRevoke={revokeAccess}
    onSaveFolderExclusions={saveFolderAccessExclusions}
  />}
          {section === "users" && <UserApprovalsContent
    pendingUsers={pendingUsers}
    activeCustomers={activeCustomers}
    error={userApprovalError}
    activeCustomerError={activeCustomerError}
    updatingUserId={updatingUserId}
    updatingUserAction={updatingUserAction}
    onApprove={approveUser}
    onDeny={(customer) => setAccountDecision({ customer, type: "deny" })}
    onRevoke={(customer) => setAccountDecision({ customer, type: "revoke" })}
  />}
          {section === "owner-users" && <OwnerUsersContent
    users={allUsers}
    error={ownerUserError}
    updatingUserId={updatingRoleUserId}
    updatingAction={updatingRoleAction}
    onMakeAdmin={promoteToAdmin}
    onRevokeAdmin={removeAdminAccess}
  />}
          {section === "audit" && <AuditContent
    auditLog={auditLog}
    error={auditLoadError}
  />}
          {section === "settings" && <SettingsContent user={user} />}
          {section === "profile" && <AdminProfileContent user={user} profilePic={profilePic} setProfilePic={setProfilePic} />}
        </main>
      </div>
      <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      {editingDocument && <DocumentEditModal
    key={editingDocument.id}
    document={editingDocument}
    folderOptions={folderOptions}
    activeCustomers={activeCustomers}
    activeCompanies={activeCompanies}
    onClose={() => setEditingDocument(null)}
    onSave={handleUpdateDocument}
  />}
      {editingFolder && <FolderEditModal
    key={editingFolder.id}
    folder={editingFolder}
    folders={folders}
    folderOptions={folderOptions}
    activeCustomers={activeCustomers}
    activeCompanies={activeCompanies}
    onClose={() => setEditingFolder(null)}
    onSave={handleUpdateFolder}
  />}
      {accountDecision && <AccountDecisionModal
    key={`${accountDecision.type}-${accountDecision.customer.id}`}
    customer={accountDecision.customer}
    type={accountDecision.type}
    onClose={() => setAccountDecision(null)}
    onConfirm={submitAccountDecision}
  />}
      {accessDecision && <DocumentAccessDecisionModal
    key={`${accessDecision.type}-${accessDecision.request.id}`}
    request={accessDecision.request}
    type={accessDecision.type}
    onClose={() => setAccessDecision(null)}
    onConfirm={submitAccessDecision}
  />}
    </div>;
}
/**
 * Sidebar navigation item for switching admin sections.
 */
function NavButton({
  label,
  Icon,
  active,
  badge,
  onClick
}) {
  const hasBadge = badge !== void 0;
  const hasPendingItems = Number(badge) > 0;

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
      {hasBadge && <span
    className="ml-auto text-xs rounded-full px-1.5 py-0.5"
    style={{
      backgroundColor: hasPendingItems ? BS_GOLD : "rgba(255,255,255,0.08)",
      color: hasPendingItems ? BS_BLACK : "#7A8490",
      fontWeight: 600,
      minWidth: "20px",
      textAlign: "center"
    }}
  >
          {badge}
        </span>}
    </button>;
}
/**
 * Admin overview cards and recent request table.
 */
function DashboardContent({
  requests,
  documents,
  pendingCount,
  pendingUserApprovalCount,
  approvedCount,
  activeCustomerCount
}) {
  const recentRequests = [...requests]
    .sort((a, b) => (
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    ))
    .slice(0, 5);
  const kpis = [
    { label: "Pending Requests", value: pendingCount, icon: Clock, color: BS_GOLD },
    { label: "User Approvals", value: pendingUserApprovalCount, icon: Users, color: BS_GOLD },
    { label: "Approved Requests", value: approvedCount, icon: CheckCircle, color: "#22C55E" },
    { label: "Total Customers", value: activeCustomerCount, icon: Users, color: "#6366F1" },
    { label: "Active Documents", value: documents.length, icon: Files, color: "#0EA5E9" }
  ];
  return <div className="space-y-6">
      {
    /* KPI row */
  }
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
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
            <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>Read-only snapshot of customer request activity</p>
          </div>
          {pendingCount > 0 && <span
    className="text-xs px-2.5 py-1 rounded-full"
    style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200", fontWeight: 500 }}
  >
              {pendingCount} pending
            </span>}
        </div>
        <DashboardRequestsTable requests={recentRequests} />
      </div>
    </div>;
}

/**
 * Read-only dashboard table for customer access request status.
 */
function DashboardRequestsTable({ requests }) {
  return <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr style={{ backgroundColor: "#FAFAFA" }}>
          {["Customer", "Company", "Resource", "Date Requested", "Status"].map((heading) => <th
            key={heading}
            className="px-4 py-3 text-left text-xs border-b border-gray-100"
            style={{ color: BS_GRAY, fontWeight: 500 }}
          >
            {heading}
          </th>)}
        </tr>
      </thead>
      <tbody>
        {requests.map((request, index) => {
          const isFolder = request.resourceType === "folder";
          const resourceTitle = request.documentTitle
            || request.folderPath
            || request.folderName
            || (isFolder ? "Folder" : "Document");

          return <tr
            key={request.id}
            style={{ borderBottom: index < requests.length - 1 ? "1px solid #F3F4F6" : "none" }}
          >
            <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{request.customerName || "—"}</td>
            <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{request.company || "—"}</td>
            <td className="px-4 py-3.5 text-xs max-w-[260px]" style={{ color: BS_BLACK }}>
              <div className="flex items-center gap-2 min-w-0">
                {isFolder
                  ? <Folder size={14} className="shrink-0" style={{ color: BS_GOLD }} />
                  : <FileText size={14} className="shrink-0" style={{ color: BS_GRAY }} />}
                <div className="min-w-0">
                  <p className="truncate" style={{ fontWeight: 600 }}>{resourceTitle}</p>
                  <p className="text-[11px]" style={{ color: BS_GRAY }}>
                    {isFolder ? "Folder" : request.documentCategory || "Document"}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{request.dateRequested || "—"}</td>
            <td className="px-4 py-3.5">
              <StatusBadge status={request.status} />
            </td>
          </tr>;
        })}
        {requests.length === 0 && <tr>
          <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
            No access requests found.
          </td>
        </tr>}
      </tbody>
    </table>
  </div>;
}
/**
 * Admin document management screen for upload, targeting, preview, edit, and delete.
 */
function DocumentsContent({
  documents,
  visibleDocuments,
  visibleFolders,
  folderBreadcrumbs,
  folderOptions,
  currentFolder,
  currentFolderId,
  setCurrentFolderId,
  uploadTitle,
  setUploadTitle,
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
  folderName,
  setFolderName,
  folderTargetType,
  setFolderTargetType,
  folderTargetCompany,
  setFolderTargetCompany,
  folderTargetCustomerId,
  setFolderTargetCustomerId,
  creatingFolder,
  folderUploadFiles,
  folderSharePaths,
  setFolderSharePaths,
  expandedFolderSharePaths,
  setExpandedFolderSharePaths,
  folderUploading,
  folderUploadProgress,
  folderUploadDone,
  folderUploadSummary,
  folderActionError,
  uploadProgress,
  uploading,
  uploadDone,
  uploadError,
  documentLoadError,
  documentActionError,
  onPreviewDocument,
  onDownloadDocument,
  onEditDocument,
  onEditFolder,
  onDeleteFolder,
  onDeleteDocument,
  fileRef,
  folderFileRef,
  onUpload,
  onCreateFolder,
  onFolderUploadFilesChange,
  onUploadFolder
}) {
  const folderUploadLabel = folderUploadFiles.length > 0
    ? `${folderUploadFiles.length} files selected`
    : "Click to select a folder";
  const folderLocationLabel = currentFolder?.path || "All Documents";
  const parentFolderId = currentFolder?.parentFolderId || "";
  const inferredUploadType = uploadFile ? inferDocumentTypeFromFileName(uploadFile.name) : "Select a file";
  const skippedFolderFiles = folderUploadSummary?.skippedFiles || [];
  const folderShareTree = buildUploadShareTree(folderUploadFiles);
  const uploadTreeFiles = flattenUploadTreeFiles(folderShareTree);
  const selectedShareFiles = uploadTreeFiles.filter((file) => folderSharePaths.has(file.path));
  const allUploadFilesSelected = uploadTreeFiles.length > 0
    && selectedShareFiles.length === uploadTreeFiles.length;
  const [documentSearch, setDocumentSearch] = useState("");
  const filteredVisibleFolders = visibleFolders.filter((folderItem) => (
    matchesSearch(documentSearch, folderItem.name, folderItem.path, folderItem.createdByName)
  ));
  const filteredVisibleDocuments = visibleDocuments.filter((document) => (
    matchesSearch(
      documentSearch,
      document.title,
      document.fileName,
      document.category,
      document.type,
      document.targetLabel,
      document.targetCustomer,
      document.targetCompany,
      document.uploadedBy,
      document.folderPath
    )
  ));

  return <div className="space-y-6">
      {
    /* Upload form */
  }
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>
              Upload Document
            </h3>
            <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
              Destination: {folderLocationLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {folderBreadcrumbs.map((breadcrumb, index) => <div key={breadcrumb.id || "root"} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight size={12} style={{ color: "#C4C9CE" }} />}
                <button
    type="button"
    onClick={() => setCurrentFolderId(breadcrumb.id)}
    className="px-2.5 py-1 rounded-lg text-xs border transition-colors hover:bg-gray-50"
    style={{
      borderColor: breadcrumb.id === currentFolderId ? BS_GOLD : "#E5E7EB",
      color: breadcrumb.id === currentFolderId ? BS_BLACK : BS_GRAY,
      fontWeight: breadcrumb.id === currentFolderId ? 600 : 500
    }}
  >
                  {breadcrumb.name}
                </button>
              </div>)}
          </div>
        </div>
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
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>File Destination</label>
            <select
    value={currentFolderId}
    onChange={(e) => setCurrentFolderId(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
              {folderOptions.map((folderOption) => <option key={folderOption.id || "root"} value={folderOption.id}>
                  {folderOption.label}
                </option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Uploads and new folders use this destination.
            </p>
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
              <option value="admin">Admins only</option>
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
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                PDF, Word, Excel, PowerPoint up to 50MB · Type: {inferredUploadType}
              </p>
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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-gray-100 pt-5">
          <form onSubmit={onCreateFolder} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FolderPlus size={16} style={{ color: BS_GOLD }} />
              <h4 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Create Folder</h4>
            </div>
            <div className="space-y-3">
              <input
    type="text"
    value={folderName}
    onChange={(event) => setFolderName(event.target.value)}
    placeholder="Folder name"
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
              <select
    value={folderTargetType}
    onChange={(event) => {
      setFolderTargetType(event.target.value);
      setFolderTargetCompany("");
      setFolderTargetCustomerId("");
    }}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
                <option value="all">All active customers</option>
                <option value="admin">Admins only</option>
                <option value="company">Specific company</option>
                <option value="customer">Specific customer</option>
              </select>
              {folderTargetType === "company" && <select
    value={folderTargetCompany}
    onChange={(event) => setFolderTargetCompany(event.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    required
  >
                  <option value="">Select an approved company</option>
                  {activeCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
                </select>}
              {folderTargetType === "customer" && <select
    value={folderTargetCustomerId}
    onChange={(event) => setFolderTargetCustomerId(event.target.value)}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    required
  >
                  <option value="">Select an approved customer</option>
                  {activeCustomers.map((customer) => <option key={customer.id} value={customer.id}>
                      {customer.name || customer.email} {customer.company ? `— ${customer.company}` : ""}
                    </option>)}
                </select>}
              <button
    type="submit"
    disabled={creatingFolder}
    className="w-full px-4 py-2.5 rounded-lg text-sm transition-opacity disabled:opacity-50 hover:opacity-90"
    style={{ backgroundColor: BS_BLACK, color: "#FFFFFF", fontWeight: 600 }}
  >
                {creatingFolder ? "Creating..." : "Create"}
              </button>
            </div>
          </form>

          <form onSubmit={onUploadFolder} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UploadCloud size={16} style={{ color: BS_GOLD }} />
              <h4 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Upload Folder</h4>
            </div>
            <div
    className="border border-dashed rounded-lg bg-white p-4 text-center cursor-pointer hover:border-[#F2A900] transition-colors"
    style={{ borderColor: "#D1D5DB" }}
    onClick={() => folderFileRef.current?.click()}
  >
              <UploadCloud size={18} className="mx-auto mb-2" style={{ color: "#9CA3AF" }} />
              <p className="text-sm" style={{ color: BS_GRAY }}>{folderUploadLabel}</p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>PDF, Word, Excel, PowerPoint</p>
            </div>
            <input
    ref={folderFileRef}
    type="file"
    className="hidden"
    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
    multiple
    webkitdirectory="true"
    directory=""
    onChange={(event) => onFolderUploadFilesChange(event.target.files)}
  />
            {folderUploadFiles.length > 0 && <div className="mt-4 rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm" style={{ color: BS_BLACK, fontWeight: 700 }}>
                        Choose what to share
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
                        Checked folders share their included documents. Unchecked files stay uploaded for admins only.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
    type="button"
    onClick={() => setFolderSharePaths(new Set(uploadTreeFiles.map((file) => file.path)))}
    className="px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-gray-50"
    style={{ borderColor: "#D1D5DB", color: BS_BLACK, fontWeight: 600 }}
  >
                        Select all
                      </button>
                      <button
    type="button"
    onClick={() => setFolderSharePaths(new Set())}
    className="px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-gray-50"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY, fontWeight: 600 }}
  >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                  <div className="max-h-72 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-2">
                    <FolderShareTree
    nodes={folderShareTree}
    selectedPaths={folderSharePaths}
    setSelectedPaths={setFolderSharePaths}
    expandedPaths={expandedFolderSharePaths}
    setExpandedPaths={setExpandedFolderSharePaths}
  />
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs uppercase tracking-wide" style={{ color: BS_GRAY, fontWeight: 700 }}>
                      Review selected items
                    </p>
                    <p className="mt-2 text-sm" style={{ color: BS_BLACK, fontWeight: 700 }}>
                      {selectedShareFiles.length} of {uploadTreeFiles.length} documents selected
                    </p>
                    {allUploadFilesSelected && <p className="mt-1 text-xs" style={{ color: "#166534", fontWeight: 600 }}>
                        Entire uploaded folder will be shared.
                      </p>}
                    {!allUploadFilesSelected && selectedShareFiles.length > 0 && <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs" style={{ color: BS_GRAY }}>
                        {selectedShareFiles.slice(0, 8).map((file) => <li key={file.path} className="truncate">
                            {file.path}
                          </li>)}
                        {selectedShareFiles.length > 8 && <li style={{ color: BS_BLACK, fontWeight: 600 }}>
                            +{selectedShareFiles.length - 8} more selected
                          </li>}
                      </ul>}
                    {selectedShareFiles.length === 0 && <p className="mt-2 text-xs text-red-700">
                        Select at least one folder or file before uploading.
                      </p>}
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 600 }}>
                        Sharing audience
                      </label>
                      <select
    value={uploadTargetType}
    onChange={(event) => {
      setUploadTargetType(event.target.value);
      setUploadTargetCompany("");
      setUploadTargetCustomerId("");
    }}
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  >
                        <option value="all">All active customers</option>
                        <option value="admin">Admins only</option>
                        <option value="company">Specific company</option>
                        <option value="customer">Specific customer</option>
                      </select>
                      {uploadTargetType === "company" && <select
    value={uploadTargetCompany}
    onChange={(event) => setUploadTargetCompany(event.target.value)}
    className="mt-2 w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    required
  >
                          <option value="">Select an approved company</option>
                          {activeCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
                        </select>}
                      {uploadTargetType === "customer" && <select
    value={uploadTargetCustomerId}
    onChange={(event) => setUploadTargetCustomerId(event.target.value)}
    className="mt-2 w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
    required
  >
                          <option value="">Select an approved customer</option>
                          {activeCustomers.map((customer) => <option key={customer.id} value={customer.id}>
                              {customer.name || customer.email} {customer.company ? `— ${customer.company}` : ""}
                            </option>)}
                        </select>}
                      <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>
                        This applies only to the checked folder items in this upload.
                      </p>
                    </div>
                  </div>
                </div>
              </div>}
            {folderUploading && <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: BS_GRAY }}>Uploading folder...</span>
                  <span className="text-xs" style={{ color: BS_GRAY }}>{folderUploadProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E9EAEC" }}>
                  <div
    className="h-full rounded-full transition-all"
    style={{ width: `${folderUploadProgress}%`, backgroundColor: BS_GOLD }}
  />
                </div>
              </div>}
            {folderUploadDone && <div className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span>
                    Uploaded {folderUploadSummary?.uploadedCount || 0} documents.
                    {folderUploadSummary?.sharedCount !== undefined ? ` Shared ${folderUploadSummary.sharedCount}.` : ""}
                    {skippedFolderFiles.length > 0 ? ` Skipped ${skippedFolderFiles.length} files.` : ""}
                  </span>
                </div>
              </div>}
            {skippedFolderFiles.length > 0 && <div
    className="mt-3 rounded-lg border px-3 py-2 text-xs"
    style={{ backgroundColor: "rgba(242,169,0,0.08)", borderColor: "rgba(242,169,0,0.22)", color: BS_GRAY }}
  >
                <p style={{ color: "#A37200", fontWeight: 600 }}>
                  Skipped unsupported or oversized files
                </p>
                <ul className="mt-1.5 space-y-1">
                  {skippedFolderFiles.slice(0, 5).map((file) => <li key={`${file.name}-${file.reason}`} className="truncate">
                      {file.name} — {file.reason}
                    </li>)}
                </ul>
                {skippedFolderFiles.length > 5 && <p className="mt-1.5">
                    +{skippedFolderFiles.length - 5} more skipped files
                  </p>}
              </div>}
            <button
    type="submit"
    disabled={folderUploading || folderUploadFiles.length === 0 || selectedShareFiles.length === 0}
    className="mt-3 px-4 py-2.5 rounded-lg text-sm transition-opacity disabled:opacity-50 hover:opacity-90"
    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
  >
              {folderUploading ? "Uploading..." : "Upload Selected Folder Items"}
            </button>
          </form>
        </div>

        {folderActionError && <div className="mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
            {folderActionError}
          </div>}
      </div>

      {
    /* Document list */
  }
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>{folderLocationLabel}</h3>
            <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
              {documents.length} total documents · {filteredVisibleFolders.length} folders · {filteredVisibleDocuments.length} documents shown
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={documentSearch}
              onChange={setDocumentSearch}
              placeholder="Search documents..."
            />
            {currentFolderId && <button
    type="button"
    onClick={() => setCurrentFolderId(parentFolderId)}
    className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY, fontWeight: 600 }}
  >
              <ArrowLeft size={12} />
              Back
            </button>}
          </div>
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
              {filteredVisibleFolders.map((folderItem) => <tr key={`folder-${folderItem.id}`} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>
                    <button
    type="button"
    onClick={() => setCurrentFolderId(folderItem.id)}
    className="inline-flex items-center gap-2 text-left hover:opacity-80"
    style={{ fontWeight: 600 }}
  >
                      <Folder size={15} style={{ color: BS_GOLD }} />
                      {folderItem.name}
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200" }}>
                      Folder
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>—</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>—</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{folderItem.createdDate}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>—</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{folderItem.createdByName || "Admin"}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
    type="button"
    onClick={() => setCurrentFolderId(folderItem.id)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
  >
                        Open <ChevronRight size={11} />
                      </button>
                      <button
    type="button"
    onClick={() => onEditFolder(folderItem)}
    className="h-7 w-7 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
    style={{ borderColor: "#D1D5DB", color: BS_GRAY }}
    aria-label={`Edit ${folderItem.name}`}
    title="Edit folder"
  >
                        <Pencil size={12} />
                      </button>
                      <button
    type="button"
    onClick={() => onDeleteFolder(folderItem)}
    className="h-7 w-7 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
    style={{ borderColor: BS_MAROON, color: BS_MAROON }}
    aria-label={`Delete ${folderItem.name}`}
    title="Delete folder"
  >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>)}
              {filteredVisibleDocuments.map((doc, i) => <tr key={doc.id} style={{ borderBottom: i < filteredVisibleDocuments.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>
                    <span className="inline-flex items-center gap-2">
                      <FileText size={14} style={{ color: BS_GRAY }} />
                      {doc.title}
                    </span>
                  </td>
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
              {filteredVisibleFolders.length === 0 && filteredVisibleDocuments.length === 0 && <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                    {documentSearch.trim() ? "No matching folders or documents." : "No folders or documents in this location."}
                  </td>
                </tr>}
	            </tbody>
	          </table>
        </div>
      </div>
    </div>;
}

/**
 * Checkbox that supports the native mixed state for partially selected folders.
 */
function ShareCheckbox({ checked, indeterminate = false, onChange, ariaLabel }) {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return <input
    ref={checkboxRef}
    type="checkbox"
    checked={checked}
    aria-label={ariaLabel}
    onChange={(event) => onChange(event.target.checked)}
    className="h-4 w-4 rounded border-gray-300 text-[#F2A900] focus:ring-[#F2A900]"
  />;
}

/**
 * Renders the selectable folder tree before a folder upload is finalized.
 */
function FolderShareTree({
  nodes,
  selectedPaths,
  setSelectedPaths,
  expandedPaths,
  setExpandedPaths
}) {
  if (nodes.length === 0) {
    return <p className="px-2 py-3 text-xs" style={{ color: BS_GRAY }}>
      No supported folder items found.
    </p>;
  }

  return <div className="space-y-1">
    {nodes.map((node) => <FolderShareNode
      key={node.id}
      node={node}
      depth={0}
      selectedPaths={selectedPaths}
      setSelectedPaths={setSelectedPaths}
      expandedPaths={expandedPaths}
      setExpandedPaths={setExpandedPaths}
    />)}
  </div>;
}

/**
 * Renders one selectable folder plus its nested folders/files.
 */
function FolderShareNode({
  node,
  depth,
  selectedPaths,
  setSelectedPaths,
  expandedPaths,
  setExpandedPaths
}) {
  const isExpanded = expandedPaths.has(node.path);
  const stats = uploadFolderSelectionStats(node, selectedPaths);
  const descendantFilePaths = collectUploadFileNodes(node).map((file) => file.path);

  const toggleExpanded = () => {
    setExpandedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);

      if (nextPaths.has(node.path)) {
        nextPaths.delete(node.path);
      } else {
        nextPaths.add(node.path);
      }

      return nextPaths;
    });
  };

  const setFolderChecked = (checked) => {
    setSelectedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);

      descendantFilePaths.forEach((filePath) => {
        if (checked) {
          nextPaths.add(filePath);
        } else {
          nextPaths.delete(filePath);
        }
      });

      return nextPaths;
    });
  };

  return <div>
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-gray-100"
        aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <ShareCheckbox
        checked={stats.checked}
        indeterminate={stats.indeterminate}
        onChange={setFolderChecked}
        ariaLabel={`Share ${node.name}`}
      />
      <Folder size={15} style={{ color: BS_GOLD }} />
      <span className="min-w-0 flex-1 truncate text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>
        {node.name}
      </span>
      <span className="text-[11px]" style={{ color: BS_GRAY }}>
        {stats.selectedCount}/{stats.totalCount}
      </span>
    </div>
    {isExpanded && <div className="space-y-1">
      {node.folders.map((folderNode) => <FolderShareNode
        key={folderNode.id}
        node={folderNode}
        depth={depth + 1}
        selectedPaths={selectedPaths}
        setSelectedPaths={setSelectedPaths}
        expandedPaths={expandedPaths}
        setExpandedPaths={setExpandedPaths}
      />)}
      {node.files.map((file) => <FolderShareFile
        key={file.id}
        file={file}
        depth={depth + 1}
        selectedPaths={selectedPaths}
        setSelectedPaths={setSelectedPaths}
      />)}
    </div>}
  </div>;
}

/**
 * Renders one selectable file inside the folder sharing tree.
 */
function FolderShareFile({ file, depth, selectedPaths, setSelectedPaths }) {
  const checked = selectedPaths.has(file.path);

  const setFileChecked = (nextChecked) => {
    setSelectedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);

      if (nextChecked) {
        nextPaths.add(file.path);
      } else {
        nextPaths.delete(file.path);
      }

      return nextPaths;
    });
  };

  return <div
    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white"
    style={{ paddingLeft: `${depth * 16 + 33}px` }}
  >
    <ShareCheckbox
      checked={checked}
      onChange={setFileChecked}
      ariaLabel={`Share ${file.name}`}
    />
    <FileText size={14} style={{ color: BS_GRAY }} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs" style={{ color: BS_BLACK, fontWeight: 600 }}>
        {file.name}
      </p>
      <p className="truncate text-[11px]" style={{ color: BS_GRAY }}>
        {file.typeLabel} · {file.sizeLabel}
      </p>
    </div>
  </div>;
}

/**
 * Admin access-request queue wrapper.
 */
function RequestsContent({ requests, documents, error, onApprove, onDeny }) {
  const [requestSearch, setRequestSearch] = useState("");
  const filteredRequests = requests.filter((request) => (
    matchesSearch(requestSearch, request.customerName, request.company)
  ));

  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Pending Access Requests</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
            Approve or deny new customer document and folder requests · {filteredRequests.length} shown
          </p>
        </div>
        <SearchInput
          value={requestSearch}
          onChange={setRequestSearch}
          placeholder="Search name or company..."
        />
      </div>
      {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>}
      <RequestsTable
        requests={filteredRequests}
        documents={documents}
        onApprove={onApprove}
        onDeny={onDeny}
        allowFolderReview
        emptyMessage={requestSearch.trim()
          ? "No matching pending access requests."
          : "No pending access requests."}
      />
    </div>;
}
/**
 * Reusable table for approving or denying pending document access requests.
 */
function RequestsTable({
  requests,
  documents = [],
  onApprove,
  onDeny,
  allowFolderReview = true,
  emptyMessage = "No pending access requests."
}) {
  const [openRequestId, setOpenRequestId] = useState("");
  const [excludedDocumentIds, setExcludedDocumentIds] = useState(new Set());
  const [savingRequestId, setSavingRequestId] = useState("");
  const [reviewError, setReviewError] = useState("");

  /**
   * Opens a folder request for file-level approval editing.
   */
  const toggleFolderReview = (request) => {
    if (openRequestId === request.id) {
      setOpenRequestId("");
      setExcludedDocumentIds(new Set());
      setReviewError("");
      return;
    }

    setOpenRequestId(request.id);
    setExcludedDocumentIds(new Set(request.excludedDocumentIds || []));
    setReviewError("");
  };

  /**
   * Checks or unchecks one file from a pending folder request.
   */
  const toggleIncludedDocument = (documentId) => {
    setExcludedDocumentIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(documentId)) {
        nextIds.delete(documentId);
      } else {
        nextIds.add(documentId);
      }

      return nextIds;
    });
  };

  /**
   * Approves the folder request while saving unchecked files as rejected.
   */
  const approveReviewedFolderRequest = async (request, folderDocuments) => {
    const includedCount = folderDocuments.length - excludedDocumentIds.size;

    if (includedCount <= 0) {
      setReviewError("Approve at least one file, or deny the folder request.");
      return;
    }

    setSavingRequestId(request.id);
    setReviewError("");

    try {
      await onApprove(request.id, Array.from(excludedDocumentIds));
      setOpenRequestId("");
      setExcludedDocumentIds(new Set());
    } catch (error) {
      setReviewError(error.message || "Unable to approve selected files.");
    } finally {
      setSavingRequestId("");
    }
  };

  return <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#FAFAFA" }}>
            {["Customer", "Company", "Resource", "Date Requested", "Status", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                {h}
              </th>)}
          </tr>
        </thead>
        <tbody>
          {requests.map((req, i) => {
            const isFolder = req.resourceType === "folder";
            const isOpen = openRequestId === req.id;
            const folderDocuments = isFolder
              ? documents
                .filter((document) => (
                  accessRequestContainsDocument(req, document)
                  && documentTargetsAccessRequest(req, document)
                ))
                .sort((a, b) => (
                  `${a.folderPath || ""}/${a.title || ""}`.localeCompare(`${b.folderPath || ""}/${b.title || ""}`)
                ))
              : [];
            const includedCount = isOpen
              ? folderDocuments.length - excludedDocumentIds.size
              : folderDocuments.length;
            const resourceTitle = req.documentTitle
              || req.folderPath
              || req.folderName
              || (isFolder ? "Folder" : "Document");

            return [
              <tr key={req.id} style={{ borderBottom: isOpen ? "none" : i < requests.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{req.customerName}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{req.company}</td>
                <td className="px-4 py-3.5 text-xs max-w-[240px]" style={{ color: BS_BLACK }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isFolder
                      ? <Folder size={14} className="shrink-0" style={{ color: BS_GOLD }} />
                      : <FileText size={14} className="shrink-0" style={{ color: BS_GRAY }} />}
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontWeight: 600 }}>{resourceTitle}</p>
                      <p className="text-[11px]" style={{ color: BS_GRAY }}>
                        {isFolder ? "Folder request" : req.documentCategory || "Document request"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>
                  <div>{req.dateRequested}</div>
                  {req.status === "pending" && req.reviewDueDate !== "—" && <div
                    className="mt-1"
                    style={{ color: req.reviewOverdue ? BS_MAROON : BS_GRAY, fontWeight: req.reviewOverdue ? 600 : 400 }}
                  >
                    {req.reviewOverdue ? "Escalate" : "Due"} {req.reviewDueDate}
                  </div>}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={req.status} />
                </td>
                <td className="px-4 py-3.5">
                  {req.status === "pending" && <div className="flex flex-wrap items-center gap-2">
                    {isFolder && allowFolderReview ? <button
                      type="button"
                      onClick={() => toggleFolderReview(req)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 border"
                      style={{ borderColor: "#D1D5DB", color: BS_BLACK, fontWeight: 500 }}
                    >
                      <Eye size={12} /> {isOpen ? "Close" : "Review"}
                    </button> : <button
                      type="button"
                      onClick={() => onApprove(req.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
                      style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
                    >
                      <CheckCircle size={12} /> Approve
                    </button>}
                    <button
                      type="button"
                      onClick={() => onDeny(req)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 border"
                      style={{ borderColor: BS_MAROON, color: BS_MAROON }}
                    >
                      <XCircle size={12} /> Deny
                    </button>
                  </div>}
                  {req.status !== "pending" && <span className="text-xs" style={{ color: "#C4C9CE" }}>—</span>}
                </td>
              </tr>,
              isFolder && isOpen && <tr key={`${req.id}-review`}>
                <td colSpan={6} className="px-4 pb-5" style={{ borderBottom: i < requests.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                      <div>
                        <h4 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Review Folder Request</h4>
                        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
                          Checked files will be approved. Unchecked files are rejected from this folder access.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200", fontWeight: 600 }}>
                          {includedCount}/{folderDocuments.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setExcludedDocumentIds(new Set())}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                          style={{ color: BS_GRAY, fontWeight: 500 }}
                        >
                          Include all
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcludedDocumentIds(new Set(folderDocuments.map((document) => document.id)))}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                          style={{ color: BS_GRAY, fontWeight: 500 }}
                        >
                          Reject all
                        </button>
                        <button
                          type="button"
                          onClick={() => approveReviewedFolderRequest(req, folderDocuments)}
                          disabled={savingRequestId === req.id || includedCount <= 0}
                          className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                          style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
                        >
                          {savingRequestId === req.id ? "Approving..." : "Approve Selected"}
                        </button>
                      </div>
                    </div>

                    {reviewError && <div className="mb-3 px-3 py-2 rounded-lg text-xs text-red-700 bg-red-50 border border-red-100">
                      {reviewError}
                    </div>}

                    <div className="rounded-lg border border-gray-100 bg-white max-h-80 overflow-y-auto">
                      {folderDocuments.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                        No requestable files were found inside this folder.
                      </div> : folderDocuments.map((document, documentIndex) => {
                        const isExcluded = excludedDocumentIds.has(document.id);

                        return <label
                          key={document.id}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                          style={{ borderBottom: documentIndex < folderDocuments.length - 1 ? "1px solid #F3F4F6" : "none" }}
                        >
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => toggleIncludedDocument(document.id)}
                            className="mt-0.5 accent-[#F2A900]"
                          />
                          <FileText size={14} className="mt-0.5 shrink-0" style={{ color: isExcluded ? BS_MAROON : BS_GRAY }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs truncate" style={{ color: BS_BLACK, fontWeight: 600 }}>
                                {document.title}
                              </p>
                              {isExcluded ? <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(138,42,43,0.12)", color: BS_MAROON, fontWeight: 600 }}>
                                Rejected
                              </span> : <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#166534", fontWeight: 600 }}>
                                Approved
                              </span>}
                            </div>
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: BS_GRAY }}>
                              {document.folderPath || "All Documents"} · {document.type} · {document.size}
                            </p>
                          </div>
                        </label>;
                      })}
                    </div>
                  </div>
                </td>
              </tr>
            ].filter(Boolean);
          })}
          {requests.length === 0 && <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                {emptyMessage}
              </td>
            </tr>}
        </tbody>
      </table>
    </div>;
}

/**
 * Shows approved access and lets admins narrow folder access by excluding nested documents.
 */
function AccessManagementContent({
  approvedRequests,
  documents,
  error,
  onRevoke,
  onSaveFolderExclusions
}) {
  const [openFolderRequestId, setOpenFolderRequestId] = useState("");
  const [excludedDocumentIds, setExcludedDocumentIds] = useState(new Set());
  const [savingFolderRequestId, setSavingFolderRequestId] = useState("");
  const [folderPanelError, setFolderPanelError] = useState("");
  const [accessSearch, setAccessSearch] = useState("");
  const filteredApprovedRequests = approvedRequests.filter((request) => (
    matchesSearch(
      accessSearch,
      request.customerName,
      request.company,
      request.documentTitle,
      request.folderName,
      request.folderPath,
      request.resourceType,
      request.documentCategory
    )
  ));

  /**
   * Opens or closes a folder request panel and loads its current excluded documents.
   */
  const toggleFolderRequest = (request) => {
    if (openFolderRequestId === request.id) {
      setOpenFolderRequestId("");
      setExcludedDocumentIds(new Set());
      setFolderPanelError("");
      return;
    }

    setOpenFolderRequestId(request.id);
    setExcludedDocumentIds(new Set(request.excludedDocumentIds || []));
    setFolderPanelError("");
  };

  /**
   * Marks one nested document as unshared or restores it for the opened folder request.
   */
  const toggleExcludedDocument = (documentId) => {
    setExcludedDocumentIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(documentId)) {
        nextIds.delete(documentId);
      } else {
        nextIds.add(documentId);
      }

      return nextIds;
    });
  };

  /**
   * Persists the nested document exclusion list through Express.
   */
  const saveExcludedDocuments = async (requestId) => {
    setSavingFolderRequestId(requestId);
    setFolderPanelError("");

    try {
      await onSaveFolderExclusions(requestId, Array.from(excludedDocumentIds));
    } catch (saveError) {
      setFolderPanelError(saveError.message || "Unable to save folder access changes.");
    } finally {
      setSavingFolderRequestId("");
    }
  };

  return <div className="bg-white rounded-xl border border-gray-100">
    <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Active Access</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
          Revoke currently approved access or unshare specific documents inside approved folder access · {filteredApprovedRequests.length} shown
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={accessSearch}
          onChange={setAccessSearch}
          placeholder="Search name, company, resource..."
        />
        <span
          className="self-start sm:self-auto text-xs px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#166534", fontWeight: 500 }}
        >
          {approvedRequests.length} active
        </span>
      </div>
    </div>

    {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
      {error}
    </div>}

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#FAFAFA" }}>
            {["Customer", "Company", "Resource", "Scope", "Granted", "Granted By", "Action"].map((heading) => <th
              key={heading}
              className="px-4 py-3 text-left text-xs border-b border-gray-100"
              style={{ color: BS_GRAY, fontWeight: 500 }}
            >
              {heading}
            </th>)}
          </tr>
        </thead>
        <tbody>
          {filteredApprovedRequests.map((request, index) => {
            const isFolder = request.resourceType === "folder";
            const resourceTitle = request.documentTitle
              || request.folderPath
              || request.folderName
              || (isFolder ? "Folder" : "Document");
            const scopeLabel = isFolder
              ? "Folder and nested contents"
              : "Single document";
            const folderDocuments = isFolder
              ? documents
                .filter((document) => (
                  accessRequestContainsDocument(request, document)
                  && documentTargetsAccessRequest(request, document)
                ))
                .sort((a, b) => (
                  `${a.folderPath || ""}/${a.title || ""}`.localeCompare(`${b.folderPath || ""}/${b.title || ""}`)
                ))
              : [];
            const isOpen = openFolderRequestId === request.id;
            const currentExcludedCount = isOpen
              ? excludedDocumentIds.size
              : (request.excludedDocumentIds || []).length;

            return [
              <tr
                key={request.id}
                style={{ borderBottom: isOpen ? "none" : index < filteredApprovedRequests.length - 1 ? "1px solid #F3F4F6" : "none" }}
              >
                <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{request.customerName || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{request.company || "—"}</td>
                <td className="px-4 py-3.5 text-xs max-w-[260px]" style={{ color: BS_BLACK }}>
                  <button
                    type="button"
                    onClick={() => isFolder && toggleFolderRequest(request)}
                    disabled={!isFolder}
                    className="flex items-center gap-2 max-w-full text-left disabled:cursor-default"
                  >
                    {isFolder
                      ? <Folder size={14} style={{ color: BS_GOLD }} />
                      : <FileText size={14} style={{ color: BS_GRAY }} />}
                    <span className="truncate">{resourceTitle}</span>
                    {isFolder && <ChevronRight
                      size={13}
                      className="shrink-0 transition-transform"
                      style={{
                        color: BS_GRAY,
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
                      }}
                    />}
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: isFolder ? "rgba(242,169,0,0.12)" : "#F3F4F6",
                        color: isFolder ? "#A37200" : BS_GRAY,
                        fontWeight: 500
                      }}
                    >
                      {scopeLabel}
                    </span>
                    {isFolder && currentExcludedCount > 0 && <span className="text-[11px]" style={{ color: BS_MAROON, fontWeight: 500 }}>
                      {currentExcludedCount} unshared
                    </span>}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{formatDate(request.reviewedAt || request.createdAt)}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{request.reviewedByName || "Admin"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {isFolder && <button
                      type="button"
                      onClick={() => toggleFolderRequest(request)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
                      style={{ borderColor: "#D1D5DB", color: BS_BLACK, fontWeight: 500 }}
                    >
                      {isOpen ? "Close" : "Manage"}
                    </button>}
                    <button
                      type="button"
                      onClick={() => onRevoke(request.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
                      style={{ borderColor: BS_MAROON, color: BS_MAROON, fontWeight: 500 }}
                    >
                      <RotateCcw size={11} />
                      {isFolder ? "Revoke Folder" : "Revoke Document"}
                    </button>
                  </div>
                </td>
              </tr>,
              isFolder && isOpen && <tr key={`${request.id}-documents`}>
                <td colSpan={7} className="px-4 pb-5" style={{ borderBottom: index < filteredApprovedRequests.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                      <div>
                        <h4 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Folder Documents</h4>
                        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
                          Check documents to unshare them from this customer's folder access.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExcludedDocumentIds(new Set(folderDocuments.map((document) => document.id)))}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                          style={{ color: BS_GRAY, fontWeight: 500 }}
                        >
                          Unshare all
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcludedDocumentIds(new Set())}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                          style={{ color: BS_GRAY, fontWeight: 500 }}
                        >
                          Restore all
                        </button>
                        <button
                          type="button"
                          onClick={() => saveExcludedDocuments(request.id)}
                          disabled={savingFolderRequestId === request.id}
                          className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                          style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
                        >
                          {savingFolderRequestId === request.id ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>

                    {folderPanelError && <div className="mb-3 px-3 py-2 rounded-lg text-xs text-red-700 bg-red-50 border border-red-100">
                      {folderPanelError}
                    </div>}

                    <div className="rounded-lg border border-gray-100 bg-white max-h-80 overflow-y-auto">
                      {folderDocuments.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                        No documents found inside this folder.
                      </div> : folderDocuments.map((document, documentIndex) => {
                        const isExcluded = excludedDocumentIds.has(document.id);

                        return <label
                          key={document.id}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                          style={{ borderBottom: documentIndex < folderDocuments.length - 1 ? "1px solid #F3F4F6" : "none" }}
                        >
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => toggleExcludedDocument(document.id)}
                            className="mt-0.5 accent-[#F2A900]"
                          />
                          <FileText size={14} className="mt-0.5 shrink-0" style={{ color: isExcluded ? BS_MAROON : BS_GRAY }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs truncate" style={{ color: BS_BLACK, fontWeight: 600 }}>
                                {document.title}
                              </p>
                              {isExcluded && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(138,42,43,0.12)", color: BS_MAROON, fontWeight: 600 }}>
                                Unshared
                              </span>}
                            </div>
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: BS_GRAY }}>
                              {document.folderPath || "All Documents"} · {document.type} · {document.size}
                            </p>
                          </div>
                        </label>;
                      })}
                    </div>
                  </div>
                </td>
              </tr>
            ].filter(Boolean);
          })}
          {filteredApprovedRequests.length === 0 && <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
              {accessSearch.trim() ? "No matching approved access records." : "No approved access to manage."}
            </td>
          </tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

/**
 * Admin customer-approval table with email/location review and account decisions.
 */
function UserApprovalsContent({
  pendingUsers,
  activeCustomers,
  error,
  activeCustomerError,
  updatingUserId,
  updatingUserAction,
  onApprove,
  onDeny,
  onRevoke
}) {
  const [userSearch, setUserSearch] = useState("");
  const filteredPendingUsers = pendingUsers.filter((customer) => (
    matchesSearch(userSearch, customer.name, customer.company, customer.email, customer.phone)
  ));
  const filteredActiveCustomers = activeCustomers.filter((customer) => (
    matchesSearch(userSearch, customer.name, customer.company, customer.email, customer.phone)
  ));

  return <div className="space-y-6">
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Search Customers</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
            Search pending approvals and active customers by name, company, email, or phone.
          </p>
        </div>
        <SearchInput
          value={userSearch}
          onChange={setUserSearch}
          placeholder="Search customers..."
        />
      </div>
    </div>

    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Pending User Approvals</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
            Review new customer accounts before they can access the portal · {filteredPendingUsers.length} shown
          </p>
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
              {["Customer", "Company", "Email", "Phone", "Email Status", "Registration Location", "Registered", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                  {h}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {filteredPendingUsers.map((pendingUser, i) => {
    const isUpdating = updatingUserId === pendingUser.id;
    const hasLocation = hasRegistrationLocation(pendingUser.registrationLocation);
    const canApprove = pendingUser.emailVerified && hasLocation;
    return <tr key={pendingUser.id} style={{ borderBottom: i < filteredPendingUsers.length - 1 ? "1px solid #F3F4F6" : "none" }}>
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
                <td className="px-4 py-3.5 text-xs min-w-[190px]" style={{ color: BS_GRAY }}>
                  {hasRegistrationLocation(pendingUser.registrationLocation) ? <a
    href={registrationLocationMapUrl(pendingUser.registrationLocation)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 hover:underline"
    title={`IP: ${pendingUser.registrationLocation.ipAddress || "Unknown"}`}
    style={{ color: BS_BLACK }}
  >
                      <MapPin size={11} />
                      {formatRegistrationLocation(pendingUser.registrationLocation)}
                      <ExternalLink size={11} />
                    </a> : <span style={{ color: BS_MAROON, fontWeight: 500 }}>Missing</span>}
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
          disabled={!canApprove}
          title={!pendingUser.emailVerified
            ? "Email verification is required before approval"
            : !hasLocation
              ? "Registration location is required before approval"
              : "Approve customer"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 500 }}
        >
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
          onClick={() => onDeny(pendingUser)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 border disabled:opacity-50"
          style={{ borderColor: BS_MAROON, color: BS_MAROON }}
        >
                      <XCircle size={12} /> Deny
                    </button>
                  </div>}
                </td>
              </tr>;
  })}
            {filteredPendingUsers.length === 0 && <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                  {userSearch.trim() ? "No matching pending customer approvals." : "No pending customer approvals."}
                </td>
              </tr>}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Active Customers</h3>
          <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
            Review approved customer accounts and revoke portal access when needed · {filteredActiveCustomers.length} shown
          </p>
        </div>
        <span
    className="text-xs px-2.5 py-1 rounded-full"
    style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#166534", fontWeight: 500 }}
  >
          {activeCustomers.length} active
        </span>
      </div>

      {activeCustomerError && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {activeCustomerError}
        </div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#FAFAFA" }}>
              {["Customer", "Company", "Email", "Phone", "Approved", "Action"].map((heading) => <th
    key={heading}
    className="px-4 py-3 text-left text-xs border-b border-gray-100"
    style={{ color: BS_GRAY, fontWeight: 500 }}
  >
                {heading}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {filteredActiveCustomers.map((customer, index) => {
    const isUpdating = updatingUserId === customer.id;

    return <tr
      key={customer.id}
      style={{ borderBottom: index < filteredActiveCustomers.length - 1 ? "1px solid #F3F4F6" : "none" }}
    >
                <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{customer.name || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{customer.company || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_BLACK }}>{customer.email || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{customer.phone || "—"}</td>
                <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{formatDate(customer.approvedAt)}</td>
                <td className="px-4 py-3.5">
                  {isUpdating ? <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: BS_GRAY, fontWeight: 500 }}>
                      <Clock size={12} />
                      {updatingUserAction === "revoke" ? "Revoking..." : "Saving..."}
                    </span> : <button
    type="button"
    onClick={() => onRevoke(customer)}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
    style={{ borderColor: BS_MAROON, color: BS_MAROON, fontWeight: 500 }}
  >
                    <XCircle size={12} /> Revoke Access
                  </button>}
                </td>
              </tr>;
  })}
            {filteredActiveCustomers.length === 0 && <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                  {userSearch.trim() ? "No matching active customer accounts." : "No active customer accounts."}
                </td>
              </tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}

/**
 * Owner-only table for viewing every user and changing admin privileges.
 */
function OwnerUsersContent({
  users,
  error,
  updatingUserId,
  updatingAction,
  onMakeAdmin,
  onRevokeAdmin
}) {
  const [allUserSearch, setAllUserSearch] = useState("");
  const filteredUsers = users.filter((account) => (
    matchesSearch(
      allUserSearch,
      account.name,
      account.email,
      account.company,
      account.phone,
      account.role,
      account.status
    )
  ));

  return <div className="bg-white rounded-xl border border-gray-100">
    <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>All Users</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
          Owner-only role management. Search by name, email, company, phone, role, or status · {filteredUsers.length} shown
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={allUserSearch}
          onChange={setAllUserSearch}
          placeholder="Search users..."
        />
        <span
          className="self-start sm:self-auto text-xs px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "rgba(242,169,0,0.12)", color: "#A37200", fontWeight: 500 }}
        >
          {users.length} users
        </span>
      </div>
    </div>

    {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
      {error}
    </div>}

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#FAFAFA" }}>
            {["Name", "Email", "Company", "Phone", "Role", "Status", "Created", "Action"].map((heading) => <th
              key={heading}
              className="px-4 py-3 text-left text-xs border-b border-gray-100"
              style={{ color: BS_GRAY, fontWeight: 500 }}
            >
              {heading}
            </th>)}
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((account, index) => {
            const isUpdating = updatingUserId === account.id;
            const isOwnerAccount = account.role === "owner";
            const canMakeAdmin = account.role === "customer" && account.status === "active";
            const canRevokeAdmin = account.role === "admin";

            return <tr
              key={account.id}
              style={{ borderBottom: index < filteredUsers.length - 1 ? "1px solid #F3F4F6" : "none" }}
            >
              <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{account.name || "—"}</td>
              <td className="px-4 py-3.5 text-xs" style={{ color: BS_BLACK }}>{account.email || "—"}</td>
              <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{account.company || "—"}</td>
              <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{account.phone || "—"}</td>
              <td className="px-4 py-3.5"><RoleBadge role={account.role} /></td>
              <td className="px-4 py-3.5"><StatusBadge status={account.status} /></td>
              <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{formatDate(account.createdAt)}</td>
              <td className="px-4 py-3.5">
                {isUpdating ? <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: BS_GRAY, fontWeight: 500 }}>
                  <Clock size={12} />
                  {updatingAction === "make-admin" ? "Making admin..." : "Revoking admin..."}
                </span> : <div className="flex items-center gap-2">
                  {canMakeAdmin && <button
                    type="button"
                    onClick={() => onMakeAdmin(account)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
                    style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
                  >
                    <ShieldCheck size={12} /> Make Admin
                  </button>}
                  {canRevokeAdmin && <button
                    type="button"
                    onClick={() => onRevokeAdmin(account)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-opacity hover:opacity-80"
                    style={{ borderColor: BS_MAROON, color: BS_MAROON, fontWeight: 500 }}
                  >
                    <XCircle size={12} /> Revoke Admin
                  </button>}
                  {isOwnerAccount && <span className="text-xs" style={{ color: BS_GRAY, fontWeight: 600 }}>Owner locked</span>}
                  {!isOwnerAccount && !canMakeAdmin && !canRevokeAdmin && <span className="text-xs" style={{ color: BS_GRAY }}>
                    {account.status === "active" ? "No role action" : "Approve first"}
                  </span>}
                </div>}
              </td>
            </tr>;
          })}
          {filteredUsers.length === 0 && <tr>
            <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
              {allUserSearch.trim() ? "No matching users found." : "No users found."}
            </td>
          </tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

/**
 * Two-step modal for deny/revoke account decisions that require a message.
 */
function AccountDecisionModal({
  customer,
  type,
  onClose,
  onConfirm
}) {
  const isRevoke = type === "revoke";
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const trimmedMessage = message.trim();

  /**
   * Validates the account decision message before calling the parent submit handler.
   */
  const handleContinue = async () => {
    if (!trimmedMessage) {
      setError("Enter a message explaining this decision.");
      return;
    }

    if (isRevoke && step === 1) {
      setError("");
      setStep(2);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm(trimmedMessage);
    } catch (submitError) {
      setError(
        submitError.message
        || (isRevoke
          ? "Unable to revoke this customer."
          : "Unable to deny this customer.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white border border-gray-100 shadow-xl">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs mb-1" style={{ color: BS_GRAY }}>
              {isRevoke ? `Step ${step} of 2` : "Account decision"}
            </p>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>
              {isRevoke ? "Revoke Customer Access" : "Deny Customer Account"}
            </h3>
            <p className="text-xs mt-1" style={{ color: BS_GRAY }}>
              {customer.name || customer.email} · {customer.company || "No company"}
            </p>
          </div>
          <button
    type="button"
    onClick={onClose}
    disabled={submitting}
    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50"
    aria-label="Close account decision"
  >
            <XCircle size={16} style={{ color: BS_GRAY }} />
          </button>
        </div>

        <div className="p-5">
          {isRevoke && step === 2 ? <div>
              <div
    className="rounded-lg border px-4 py-3 mb-4"
    style={{ backgroundColor: "rgba(138,42,43,0.05)", borderColor: "rgba(138,42,43,0.18)" }}
  >
                <p className="text-sm" style={{ color: BS_MAROON, fontWeight: 600 }}>
                  Confirm account revocation
                </p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: BS_GRAY }}>
                  This customer will immediately lose access to the portal and all approved documents.
                </p>
              </div>
              <p className="text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 600 }}>Message shown to customer</p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm whitespace-pre-wrap" style={{ color: BS_BLACK }}>
                {trimmedMessage}
              </div>
            </div> : <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 600 }}>
                Message shown when the customer signs in
              </label>
              <textarea
    value={message}
    onChange={(event) => {
      setMessage(event.target.value);
      if (error) setError("");
    }}
    maxLength={500}
    rows={5}
    placeholder={isRevoke
      ? "Explain why this customer's portal access is being revoked..."
      : "Explain why this account request was denied..."}
    className="w-full resize-none px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
              <div className="mt-1 flex items-center justify-between gap-4">
                <p className="text-xs" style={{ color: BS_GRAY }}>Be concise and avoid including sensitive internal information.</p>
                <span className="text-xs flex-shrink-0" style={{ color: BS_GRAY }}>{message.length}/500</span>
              </div>
            </div>}

          {error && <div className="mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
              {error}
            </div>}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <button
    type="button"
    onClick={isRevoke && step === 2 ? () => setStep(1) : onClose}
    disabled={submitting}
    className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
    style={{ color: BS_GRAY }}
  >
            {isRevoke && step === 2 ? "Back" : "Cancel"}
          </button>
          <button
    type="button"
    onClick={handleContinue}
    disabled={submitting}
    className="px-5 py-2 rounded-lg text-sm transition-opacity hover:opacity-85 disabled:opacity-50"
    style={{
      backgroundColor: isRevoke || type === "deny" ? BS_MAROON : BS_GOLD,
      color: "#FFFFFF",
      fontWeight: 600
    }}
  >
            {submitting
      ? (isRevoke ? "Revoking..." : "Denying...")
      : isRevoke && step === 1
        ? "Review Revocation"
        : isRevoke
          ? "Confirm Revocation"
          : "Deny Account"}
          </button>
        </div>
      </div>
    </div>;
}
/**
 * Two-step modal for deny/revoke document access decisions that require a message.
 */
function DocumentAccessDecisionModal({
  request,
  type,
  onClose,
  onConfirm
}) {
  const isRevoke = type === "revoke";
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const trimmedMessage = message.trim();

  /**
   * Validates the document-access decision message before calling the parent submit handler.
   */
  const handleContinue = async () => {
    if (!trimmedMessage) {
      setError("Enter a message explaining this decision.");
      return;
    }

    if (isRevoke && step === 1) {
      setError("");
      setStep(2);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm(trimmedMessage);
    } catch (submitError) {
      setError(
        submitError.message
        || (isRevoke
          ? "Unable to revoke document access."
          : "Unable to deny this document request.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white border border-gray-100 shadow-xl">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs mb-1" style={{ color: BS_GRAY }}>
              {isRevoke ? `Step ${step} of 2` : "Document access decision"}
            </p>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>
              {isRevoke ? "Revoke Document Access" : "Deny Document Request"}
            </h3>
            <p className="text-xs mt-1 truncate" style={{ color: BS_GRAY }}>
              {request.customerName || request.customerEmail} · {request.documentTitle}
            </p>
          </div>
          <button
    type="button"
    onClick={onClose}
    disabled={submitting}
    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50"
    aria-label="Close document access decision"
  >
            <XCircle size={16} style={{ color: BS_GRAY }} />
          </button>
        </div>

        <div className="p-5">
          {isRevoke && step === 2 ? <div>
              <div
    className="rounded-lg border px-4 py-3 mb-4"
    style={{ backgroundColor: "rgba(138,42,43,0.05)", borderColor: "rgba(138,42,43,0.18)" }}
  >
                <p className="text-sm" style={{ color: BS_MAROON, fontWeight: 600 }}>
                  Confirm document access revocation
                </p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: BS_GRAY }}>
                  The customer will immediately lose preview and download access to this document.
                </p>
              </div>
              <p className="text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 600 }}>Message shown to customer</p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm whitespace-pre-wrap" style={{ color: BS_BLACK }}>
                {trimmedMessage}
              </div>
            </div> : <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 600 }}>
                Message sent to the customer
              </label>
              <textarea
    value={message}
    onChange={(event) => {
      setMessage(event.target.value);
      if (error) setError("");
    }}
    maxLength={500}
    rows={5}
    placeholder={isRevoke
      ? "Explain why access to this document is being revoked..."
      : "Explain why this document request was denied..."}
    className="w-full resize-none px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
    style={{ color: BS_BLACK }}
  />
              <div className="mt-1 flex items-center justify-between gap-4">
                <p className="text-xs" style={{ color: BS_GRAY }}>This message appears in the customer notification and request history.</p>
                <span className="text-xs flex-shrink-0" style={{ color: BS_GRAY }}>{message.length}/500</span>
              </div>
            </div>}

          {error && <div className="mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
              {error}
            </div>}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <button
    type="button"
    onClick={isRevoke && step === 2 ? () => setStep(1) : onClose}
    disabled={submitting}
    className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
    style={{ color: BS_GRAY }}
  >
            {isRevoke && step === 2 ? "Back" : "Cancel"}
          </button>
          <button
    type="button"
    onClick={handleContinue}
    disabled={submitting}
    className="px-5 py-2 rounded-lg text-sm transition-opacity hover:opacity-85 disabled:opacity-50"
    style={{ backgroundColor: BS_MAROON, color: "#FFFFFF", fontWeight: 600 }}
  >
            {submitting
      ? (isRevoke ? "Revoking..." : "Denying...")
      : isRevoke && step === 1
        ? "Review Revocation"
        : isRevoke
          ? "Confirm Revocation"
          : "Deny Request"}
          </button>
        </div>
      </div>
    </div>;
}
/**
 * Audit-log view for account, request, document, and download activity.
 */
function AuditContent({
  auditLog,
  error
}) {
  return <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Audit Log</h3>
        <p className="text-xs mt-0.5" style={{ color: BS_GRAY }}>
          Read-only record of account, document, folder, download, and access activity.
        </p>
      </div>
      {error && <div className="mx-5 mt-4 px-4 py-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#FAFAFA" }}>
              {["Customer", "Company", "Document", "Action", "Performed By", "Timestamp"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs border-b border-gray-100" style={{ color: BS_GRAY, fontWeight: 500 }}>
                  {h}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {auditLog.map((entry, i) => <tr key={entry.id} style={{ borderBottom: i < auditLog.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td className="px-4 py-3.5 font-medium" style={{ color: BS_BLACK }}>{entry.customer}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{entry.company}</td>
                  <td className="px-4 py-3.5 text-xs max-w-[180px] truncate" style={{ color: BS_BLACK }}>{entry.document}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={entry.action} />
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{entry.admin || entry.customer || "—"}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: BS_GRAY }}>{entry.timestamp}</td>
                </tr>)}
            {auditLog.length === 0 && <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: BS_GRAY }}>
                  No audit activity yet.
                </td>
              </tr>}
          </tbody>
        </table>
      </div>
  </div>;
}

/**
 * Modal form for editing document metadata and target audience.
 */
function DocumentEditModal({
  document,
  folderOptions,
  activeCustomers,
  activeCompanies,
  onClose,
  onSave
}) {
  const [form, setForm] = useState({
    title: document.title || "",
    category: document.category || "Other",
    folderId: document.folderId || "",
    targetType: document.targetType || "all",
    targetCompany: document.targetCompany || "",
    targetCustomerId: document.targetCustomerId || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /**
   * Updates one field in the document edit form.
   */
  const update = (field) => (event) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value
    }));
  };

  /**
   * Sends edited document metadata back to the admin dashboard handler.
   */
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
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>File Destination</label>
            <select value={form.folderId} onChange={update("folderId")} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              {folderOptions.map((folderOption) => <option key={folderOption.id || "root"} value={folderOption.id}>
                  {folderOption.label}
                </option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Moves this document in the admin folder list.
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Category</label>
            <select value={form.category} onChange={update("category")} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              {["Safety", "Technical", "Compliance", "Operations", "Legal", "Other"].map((category) => <option key={category}>{category}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Type is automatic: {document.type || inferDocumentTypeFromFileName(document.fileName)}
            </p>
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
              <option value="admin">Admins only</option>
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

/**
 * Modal form for editing folder metadata and applying rules to nested documents.
 */
function FolderEditModal({
  folder,
  folders,
  folderOptions,
  activeCustomers,
  activeCompanies,
  onClose,
  onSave
}) {
  const [form, setForm] = useState({
    name: folder.name || "",
    parentFolderId: folder.parentFolderId || "",
    category: "__keep",
    targetType: "__keep",
    targetCompany: "",
    targetCustomerId: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const folderMap = new Map(folders.map((folderItem) => [folderItem.id, folderItem]));
  const availableFolderOptions = folderOptions.filter((folderOption) => {
    if (!folderOption.id) return true;
    let parentCheck = folderMap.get(folderOption.id);

    while (parentCheck) {
      if (parentCheck.id === folder.id) {
        return false;
      }

      parentCheck = folderMap.get(parentCheck.parentFolderId);
    }

    return true;
  });

  /**
   * Updates one field in the folder edit form.
   */
  const update = (field) => (event) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value
    }));
  };

  /**
   * Sends edited folder metadata back to the admin dashboard handler.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave(folder.id, form);
    } catch (saveError) {
      setError(saveError.message || "Unable to update folder.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-lg bg-white border border-gray-100 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>Edit Folder</h3>
            <p className="text-xs mt-0.5 truncate max-w-sm" style={{ color: BS_GRAY }}>{folder.path || folder.name}</p>
          </div>
          <button
    type="button"
    onClick={onClose}
    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
    aria-label="Close edit folder"
  >
            <XCircle size={16} style={{ color: BS_GRAY }} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Folder Name</label>
            <input
    value={form.name}
    onChange={update("name")}
    required
    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
  />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Folder Destination</label>
            <select value={form.parentFolderId} onChange={update("parentFolderId")} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              {availableFolderOptions.map((folderOption) => <option key={folderOption.id || "root"} value={folderOption.id}>
                  {folderOption.label}
                </option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Moves this folder in the admin folder list.
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: BS_GRAY }}>Category</label>
            <select value={form.category} onChange={update("category")} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              <option value="__keep">Keep existing categories</option>
              {["Safety", "Technical", "Compliance", "Operations", "Legal", "Other"].map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Applies to documents inside this folder and subfolders.
            </p>
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
              <option value="__keep">Keep existing audience</option>
              <option value="all">All active customers</option>
              <option value="admin">Admins only</option>
              <option value="company">Specific company</option>
              <option value="customer">Specific customer</option>
            </select>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Audience changes apply to documents in this folder tree; only share-enabled documents are visible to customers.
            </p>
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

/**
 * Admin settings page placeholder for account and security preferences.
 */
function SettingsContent({ user }) {
  const { changePassword } = useAuth();
  const [autoCompanies, setAutoCompanies] = useState(["BrandTech Solutions", "Apex Industries"]);
  const [autoUsers, setAutoUsers] = useState(["james.walker@apexind.com"]);
  const [companyInput, setCompanyInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [reviewWindow, setReviewWindow] = useState("7");
  const [accessDuration, setAccessDuration] = useState("0");
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsError, setDefaultsError] = useState("");
  const [defaultsMessage, setDefaultsMessage] = useState("");
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

  useEffect(() => {
    let active = true;

    /**
     * Function from settingsService.js; loads saved review/access defaults from Express.
     */
    loadAccessRequestDefaults()
      .then((settings) => {
        if (!active) return;
        setReviewWindow(String(settings.reviewWindowDays ?? 7));
        setAccessDuration(String(settings.defaultAccessDurationDays ?? 0));
        setDefaultsError("");
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setDefaultsError(error.message || "Unable to load access request defaults.");
        }
      })
      .finally(() => {
        if (active) setDefaultsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /**
   * Function from settingsService.js; saves review window and approved-access duration through Express.
   */
  const handleDefaultsSubmit = async (event) => {
    event.preventDefault();
    setDefaultsSaving(true);
    setDefaultsError("");
    setDefaultsMessage("");

    try {
      const settings = await saveAccessRequestDefaults({
        reviewWindowDays: Number(reviewWindow),
        defaultAccessDurationDays: Number(accessDuration)
      });

      setReviewWindow(String(settings.reviewWindowDays));
      setAccessDuration(String(settings.defaultAccessDurationDays));
      setDefaultsMessage("Access request defaults saved.");
    } catch (error) {
      setDefaultsError(error.message || "Unable to save access request defaults.");
    } finally {
      setDefaultsSaving(false);
    }
  };

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
    /* ── Access Request Defaults ── */
  }
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <h3 className="text-sm mb-1" style={{ color: BS_BLACK, fontWeight: 600 }}>Access Request Defaults</h3>
          <p className="text-xs mb-5" style={{ color: BS_GRAY }}>Default settings applied to all incoming document access requests.</p>
          <form onSubmit={handleDefaultsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Review Window (days)</label>
              <select
                value={reviewWindow}
                onChange={(e) => {
                  setReviewWindow(e.target.value);
                  setDefaultsError("");
                  setDefaultsMessage("");
                }}
                disabled={defaultsLoading}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] disabled:opacity-60"
                style={{ color: BS_BLACK }}
              >
                {["3", "5", "7", "14", "30"].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: BS_GRAY }}>Requests not reviewed within this window are flagged for escalation.</p>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: BS_GRAY, fontWeight: 500 }}>Default Document Access Duration</label>
              <select
                value={accessDuration}
                onChange={(e) => {
                  setAccessDuration(e.target.value);
                  setDefaultsError("");
                  setDefaultsMessage("");
                }}
                disabled={defaultsLoading}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900] disabled:opacity-60"
                style={{ color: BS_BLACK }}
              >
                {[["0", "No expiry"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"], ["180", "6 months"], ["365", "1 year"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: BS_GRAY }}>
                No expiry keeps approved access active until an admin revokes it.
              </p>
            </div>
            {defaultsError && <div className="px-3 py-2 rounded-lg text-xs text-red-700 bg-red-50 border border-red-100">
              {defaultsError}
            </div>}
            {defaultsMessage && <div className="px-3 py-2 rounded-lg text-xs text-green-700 bg-green-50 border border-green-100">
              {defaultsMessage}
            </div>}
            <button
              type="submit"
              disabled={defaultsLoading || defaultsSaving}
              className="px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
            >
              {defaultsSaving ? "Saving..." : defaultsLoading ? "Loading..." : "Save Defaults"}
            </button>
          </form>
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
/**
 * Admin profile screen for local avatar preview and basic profile display.
 */
function AdminProfileContent({
  user,
  profilePic,
  setProfilePic
}) {
  const picRef = useRef(null);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saved, setSaved] = useState(false);

  /**
   * Reads the selected profile image locally for an immediate avatar preview.
   */
  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target?.result);
    reader.readAsDataURL(file);
  };

  /**
   * Shows a temporary saved state for the local profile form.
   */
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

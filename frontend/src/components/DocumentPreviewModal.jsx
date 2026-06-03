import { Download, FileText, X } from "lucide-react";

const BS_BLACK = "#101820";
const BS_GOLD = "#F2A900";
const BS_GRAY = "#565A5C";

function isImage(document) {
  const type = (document?.fileType || "").toLowerCase();
  return type.startsWith("image/");
}

function isPdf(document) {
  const type = (document?.fileType || "").toLowerCase();
  const name = (document?.fileName || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

function isOfficeDocument(document) {
  const name = (document?.fileName || "").toLowerCase();
  return [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"].some((ext) => name.endsWith(ext));
}

function getPreviewUrl(document) {
  if (!document?.downloadURL) return "";

  if (isPdf(document) || isImage(document)) {
    return document.downloadURL;
  }

  return "";
}

function DocumentPreviewModal({ document, onClose }) {
  if (!document) return null;

  const previewUrl = getPreviewUrl(document);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl border border-gray-100">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-sm truncate" style={{ color: BS_BLACK, fontWeight: 600 }}>
              {document.title || document.fileName || "Document Preview"}
            </h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: BS_GRAY }}>
              {document.category || "Uncategorized"} · {document.fileName || document.type || "File"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
    type="button"
    onClick={onClose}
    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100"
    style={{ color: BS_GRAY }}
    aria-label="Close preview"
  >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="h-[70vh] bg-gray-50">
          {previewUrl && isImage(document) && <img
    src={previewUrl}
    alt={document.title || document.fileName || "Document preview"}
    className="h-full w-full object-contain"
  />}

          {previewUrl && !isImage(document) && <iframe
    title={document.title || document.fileName || "Document preview"}
    src={previewUrl}
    className="h-full w-full border-0 bg-white"
  />}

          {!previewUrl && <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="h-14 w-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "#F3F4F6" }}>
                <FileText size={24} style={{ color: BS_GRAY }} />
              </div>
              <p className="text-sm" style={{ color: BS_BLACK, fontWeight: 600 }}>
                {isOfficeDocument(document) ? "Office document preview is not available in-app." : "Preview is not available for this file type."}
              </p>
              <p className="text-xs mt-1 max-w-sm" style={{ color: BS_GRAY }}>
                {isOfficeDocument(document)
      ? "Open or download the file to view it in Word, Excel, PowerPoint, or your browser's default viewer."
      : "Download or open the document to view it with the appropriate desktop application."}
              </p>
              {document.downloadURL && <div className="mt-5 flex items-center gap-2">
                  <a
      href={document.downloadURL}
      target="_blank"
      rel="noreferrer"
      download={document.fileName || document.title}
      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-85"
      style={{ backgroundColor: BS_GOLD, color: BS_BLACK, fontWeight: 600 }}
    >
                    <Download size={13} />
                    Download
                  </a>
                </div>}
            </div>}
        </div>
      </div>
    </div>;
}

export default DocumentPreviewModal;

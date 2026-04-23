import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, BookOpen, AlertCircle, Loader2, FileText, Link, Library, RefreshCw } from "lucide-react";
import { parseOpenStaxHTML } from "@/utils/htmlParser";
import { useApp } from "@/context/AppContext";
import type { BookData } from "@/types";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const UPLOAD_TIMEOUT_MS = 120_000;

interface LibraryBook {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  status: "importing" | "ready" | "error";
  totalSections: number;
  importedSections: number;
  errorMessage: string | null;
}

export function UploadPage() {
  const { setBook } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/books`);
      if (res.ok) {
        const data: LibraryBook[] = await res.json();
        setLibraryBooks(data);
        setPollFailures(0);
        return data;
      }
    } catch {
      setPollFailures(prev => prev + 1);
    }
    return [];
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  useEffect(() => {
    const hasImporting = libraryBooks.some((b) => b.status === "importing");
    if (!hasImporting || pollFailures >= 5) return;

    const id = setInterval(() => {
      fetchLibrary();
    }, 3000);

    return () => {
      clearInterval(id);
    };
  }, [libraryBooks, fetchLibrary, pollFailures]);

  const loadBookFromLibrary = useCallback(async (slug: string) => {
    setLoadingSlug(slug);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/books/${slug}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to load book.");
        return;
      }
      const book: BookData = await res.json();
      if (book.sections.length === 0) {
        setError("This book has no readable content.");
        return;
      }
      setBook(book);
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setLoadingSlug(null);
    }
  }, [setBook]);

  const handleImport = useCallback(async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    setError(null);
    setImportStatus(null);

    try {
      const res = await fetch(`${API_BASE}/api/books/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start import.");
        return;
      }

      if (data.status === "ready") {
        setImportStatus("Book is ready! Loading...");
        loadBookFromLibrary(data.slug);
      } else {
        setImportStatus(data.message || "Import started...");
        setImportUrl("");
        fetchLibrary();
      }
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setIsImporting(false);
    }
  }, [importUrl, loadBookFromLibrary, fetchLibrary]);

  const processPdf = useCallback(async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      setError("File is too large (max 100 MB). Try uploading individual chapters.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/parse-pdf`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to parse PDF. Please try a different file.");
        return;
      }

      const book: BookData = await res.json();

      if (book.sections.length === 0) {
        setError("No readable content found in this PDF.");
        return;
      }

      setBook(book);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Upload timed out. The file may be too large — try a smaller PDF or individual chapters.");
      } else {
        setError("Could not connect to the server. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  }, [setBook]);

  const processHtml = useCallback(async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      setError("File is too large (max 50 MB). Try uploading individual chapters.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const text = await file.text();
      const book = parseOpenStaxHTML(text, file.name);

      if (book.sections.length === 0) {
        setError("Could not find readable content in this file. Make sure it's an OpenStax HTML textbook.");
        return;
      }

      setBook(book);
    } catch {
      setError("Something went wrong reading the file. Try a different file.");
    } finally {
      setIsProcessing(false);
    }
  }, [setBook]);

  const processFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      processPdf(file);
    } else if (name.endsWith(".html") || name.endsWith(".htm")) {
      processHtml(file);
    } else {
      setError("Please upload a PDF or HTML file.");
    }
  }, [processPdf, processHtml]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const readyBooks = libraryBooks.filter((b) => b.status === "ready");
  const importingBooks = libraryBooks.filter((b) => b.status === "importing");

  return (
    <div className="upload-page">
      <div className="upload-content">
        <div className="upload-logo">
          <BookOpen size={40} />
        </div>
        <h1 className="upload-title">TrailReader</h1>
        <p className="upload-subtitle">
          Load your OpenStax textbook and read along with audio and AI tutoring.
        </p>

        <div className="upload-import-section">
          <h2 className="upload-section-heading">
            <Link size={16} />
            Import from OpenStax
          </h2>
          <div className="upload-import-row">
            <input
              type="text"
              className="upload-import-input"
              placeholder="Paste OpenStax book URL or slug..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImport()}
              disabled={isImporting}
            />
            <button
              type="button"
              className="upload-import-btn"
              onClick={handleImport}
              disabled={isImporting || !importUrl.trim()}
            >
              {isImporting ? <Loader2 size={16} className="spin" /> : "Import"}
            </button>
          </div>
          {importStatus && (
            <p className="upload-import-status">{importStatus}</p>
          )}
        </div>

        {(readyBooks.length > 0 || importingBooks.length > 0) && (
          <div className="upload-library">
            <h2 className="upload-section-heading">
              <Library size={16} />
              Your Library
            </h2>
            <div className="upload-library-list">
              {readyBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  className="upload-library-item"
                  onClick={() => loadBookFromLibrary(book.slug)}
                  disabled={loadingSlug === book.slug}
                >
                  <BookOpen size={18} />
                  <span className="upload-library-title">{book.title}</span>
                  {loadingSlug === book.slug ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <span className="upload-library-sections">{book.totalSections} sections</span>
                  )}
                </button>
              ))}
              {importingBooks.map((book) => (
                <div key={book.id} className="upload-library-item upload-library-importing">
                  <RefreshCw size={18} className="spin" />
                  <span className="upload-library-title">{book.title}</span>
                  <span className="upload-library-progress">
                    {book.importedSections}/{book.totalSections || "?"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="upload-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="upload-divider">
          <span>or upload a file</span>
        </div>

        <div
          className={`upload-dropzone ${isDragging ? "upload-dropzone-active" : ""} ${isProcessing ? "upload-dropzone-loading" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isProcessing && pdfInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === "Enter" && !isProcessing && pdfInputRef.current?.click()}
          aria-label="Upload textbook PDF file"
        >
          {isProcessing ? (
            <div className="upload-processing">
              <Loader2 size={32} className="spin" />
              <p>Parsing your textbook…</p>
              <p className="upload-processing-sub">This may take a moment for large files.</p>
            </div>
          ) : (
            <>
              <Upload size={24} className="upload-icon" />
              <p className="upload-drop-text">Drop your textbook PDF here</p>
              <p className="upload-drop-sub">or click to browse</p>
            </>
          )}
        </div>

        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          onChange={e => handleFiles(e.target.files)}
          className="upload-file-input"
          aria-hidden="true"
        />

        <button
          type="button"
          className="upload-html-fallback"
          onClick={() => htmlInputRef.current?.click()}
          disabled={isProcessing}
        >
          <FileText size={16} />
          Or upload an HTML file instead
        </button>

        <input
          ref={htmlInputRef}
          type="file"
          accept=".html,.htm"
          onChange={e => handleFiles(e.target.files)}
          className="upload-file-input"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

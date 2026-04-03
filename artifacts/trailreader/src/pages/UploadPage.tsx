import { useState, useRef, useCallback } from "react";
import { Upload, BookOpen, AlertCircle, Loader2, FileText } from "lucide-react";
import { parseOpenStaxHTML } from "@/utils/htmlParser";
import { useApp } from "@/context/AppContext";
import type { BookData } from "@/types";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const UPLOAD_TIMEOUT_MS = 120_000;

export function UploadPage() {
  const { setBook } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

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
              <Upload size={32} className="upload-icon" />
              <p className="upload-drop-text">Drop your textbook PDF here</p>
              <p className="upload-drop-sub">or click to browse</p>
              <span className="upload-file-type">.pdf</span>
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

        {error && (
          <div className="upload-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="upload-instructions">
          <h2>How to get your textbook</h2>
          <ol>
            <li>Go to <strong>openstax.org</strong> and open your textbook</li>
            <li>Click <strong>"Get this book"</strong> and download the <strong>PDF</strong></li>
            <li>Upload the <code>.pdf</code> file here</li>
          </ol>
          <p className="upload-privacy-note">
            Your PDF is sent to our server for text extraction, then discarded immediately. Nothing is stored.
          </p>
        </div>
      </div>
    </div>
  );
}

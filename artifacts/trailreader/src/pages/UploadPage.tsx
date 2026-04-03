import { useState, useRef, useCallback } from "react";
import { Upload, BookOpen, AlertCircle, Loader2 } from "lucide-react";
import { parseOpenStaxHTML } from "@/utils/htmlParser";
import { useApp } from "@/context/AppContext";

export function UploadPage() {
  const { setBook } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      setError("Please upload an HTML file (OpenStax textbooks downloaded as .html)");
      return;
    }
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
    } catch (err) {
      setError("Something went wrong reading the file. Try a different file.");
    } finally {
      setIsProcessing(false);
    }
  }, [setBook]);

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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

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
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === "Enter" && !isProcessing && fileInputRef.current?.click()}
          aria-label="Upload textbook HTML file"
        >
          {isProcessing ? (
            <div className="upload-processing">
              <Loader2 size={32} className="spin" />
              <p>Parsing your textbook…</p>
              <p className="upload-processing-sub">This takes a few seconds for large files.</p>
            </div>
          ) : (
            <>
              <Upload size={32} className="upload-icon" />
              <p className="upload-drop-text">Drop your textbook here</p>
              <p className="upload-drop-sub">or click to browse</p>
              <span className="upload-file-type">.html or .htm</span>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm"
          onChange={handleFileInput}
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
            <li>Navigate to the chapter you want to study</li>
            <li>Use <strong>File → Save Page As…</strong> in your browser</li>
            <li>Choose <strong>"Webpage, Complete"</strong> or <strong>"HTML Only"</strong></li>
            <li>Upload the <code>.html</code> file here</li>
          </ol>
          <p className="upload-privacy-note">
            Your file stays on your device — nothing is uploaded to any server.
          </p>
        </div>
      </div>
    </div>
  );
}

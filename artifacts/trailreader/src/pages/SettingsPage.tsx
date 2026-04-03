import { useState } from "react";
import { ArrowLeft, Trash2, ExternalLink, BookOpen, Save } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useApp } from "@/context/AppContext";

export function SettingsPage() {
  const { oatEngineUrl, setOatEngineUrl, book, clearBook } = useApp();
  const [urlInput, setUrlInput] = useState(oatEngineUrl);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [, navigate] = useLocation();

  const handleSave = () => {
    setOatEngineUrl(urlInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearBook = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearBook();
    setConfirmClear(false);
    navigate("/");
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link href="/" className="icon-btn" aria-label="Back to reader">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>

      <div className="settings-body">
        <section className="settings-section">
          <h2 className="settings-section-title">
            <ExternalLink size={16} />
            OAT Engine Link
          </h2>
          <p className="settings-desc">
            Add a link to your OAT Engine practice app so you can switch between reading and practice easily.
          </p>
          <div className="settings-field">
            <label htmlFor="oat-url" className="settings-label">OAT Engine URL</label>
            <input
              id="oat-url"
              type="url"
              className="settings-input"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://your-oat-engine.app"
            />
          </div>
          <button className="settings-btn settings-btn-primary" onClick={handleSave}>
            <Save size={16} />
            {saved ? "Saved!" : "Save URL"}
          </button>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">
            <BookOpen size={16} />
            Loaded Book
          </h2>
          {book ? (
            <>
              <div className="settings-book-info">
                <span className="settings-book-name">{book.name}</span>
                <span className="settings-book-meta">
                  {book.chapters.length} chapters · {book.sections.length} sections
                </span>
              </div>
              <button
                className={`settings-btn settings-btn-danger ${confirmClear ? "settings-btn-danger-active" : ""}`}
                onClick={handleClearBook}
              >
                <Trash2 size={16} />
                {confirmClear ? "Tap again to confirm" : "Clear book"}
              </button>
              {confirmClear && (
                <button
                  className="settings-btn settings-btn-ghost"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <p className="settings-desc settings-no-book">No book loaded. Go back to upload one.</p>
          )}
        </section>

        <section className="settings-section settings-section-about">
          <h2 className="settings-section-title">About</h2>
          <p className="settings-desc">
            <strong>TrailReader</strong> is a personal study tool for OAT prep. All your data stays on your
            device — nothing is uploaded to any server. The AI tutor (Trail Guide) sends your questions
            to Claude, but your book content stays local.
          </p>
          <p className="settings-version">v1.0 · Built for Jerald</p>
        </section>
      </div>
    </div>
  );
}

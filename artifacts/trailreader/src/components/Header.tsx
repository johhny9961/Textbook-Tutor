import { Menu, Settings, BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useApp } from "@/context/AppContext";

interface HeaderProps {
  onMenuClick: () => void;
  sectionTitle?: string;
  chapterTitle?: string;
  progress?: number;
}

export function Header({ onMenuClick, sectionTitle, chapterTitle, progress = 0 }: HeaderProps) {
  const { oatEngineUrl } = useApp();

  return (
    <header className="header">
      <div className="header-inner">
        <button
          className="icon-btn"
          onClick={onMenuClick}
          aria-label="Open table of contents"
        >
          <Menu size={20} />
        </button>

        <div className="header-title-group">
          <div className="header-book-icon">
            <BookOpen size={14} />
          </div>
          <div className="header-titles">
            {chapterTitle && (
              <span className="header-chapter">{chapterTitle}</span>
            )}
            {sectionTitle && (
              <span className="header-section">{sectionTitle}</span>
            )}
            {!chapterTitle && !sectionTitle && (
              <span className="header-section">TrailReader</span>
            )}
          </div>
        </div>

        <div className="header-actions">
          {oatEngineUrl && (
            <a
              href={oatEngineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              aria-label="Open OAT Engine"
              title="Switch to OAT Engine"
            >
              <ExternalLink size={18} />
            </a>
          )}
          <Link href="/settings" className="icon-btn" aria-label="Settings">
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {progress > 0 && (
        <div className="header-progress-bar">
          <div
            className="header-progress-fill"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </header>
  );
}

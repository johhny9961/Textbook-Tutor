import { useState, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { X, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import type { BookData } from "@/types";

interface TOCDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookData;
  currentSectionIdx: number;
  onSectionSelect: (idx: number) => void;
}

export function TOCDrawer({ isOpen, onClose, book, currentSectionIdx, onSectionSelect }: TOCDrawerProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(
    () => {
      const currentSection = book.sections[currentSectionIdx];
      return new Set(currentSection ? [currentSection.chapterIndex] : [0]);
    }
  );

  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      asideRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  const toggleChapter = (chIdx: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chIdx)) next.delete(chIdx);
      else next.add(chIdx);
      return next;
    });
  };

  const handleSectionClick = (globalIdx: number, chapterIdx: number) => {
    setExpandedChapters(prev => new Set([...prev, chapterIdx]));
    onSectionSelect(globalIdx);
    onClose();
  };

  return (
    <>
      <button
        className={`toc-overlay ${isOpen ? "toc-overlay-visible" : ""}`}
        onClick={onClose}
        aria-label="Close table of contents"
        tabIndex={isOpen ? 0 : -1}
        type="button"
      />
      <aside
        ref={asideRef as RefObject<HTMLElement>}
        className={`toc-drawer ${isOpen ? "toc-drawer-open" : ""}`}
        role="dialog"
        aria-label="Table of contents"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{ outline: "none" }}
      >
        <div className="toc-header">
          <div className="toc-header-title">
            <BookOpen size={16} />
            <span>{book.name}</span>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close table of contents"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="toc-nav">
          {book.chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.index);
            const hasActiveSec = chapter.sections.some(
              s => book.sections.indexOf(s) === currentSectionIdx
            );

            return (
              <div key={chapter.index} className="toc-chapter">
                <button
                  className={`toc-chapter-btn ${hasActiveSec ? "toc-chapter-active" : ""}`}
                  onClick={() => toggleChapter(chapter.index)}
                  aria-expanded={isExpanded}
                  type="button"
                >
                  <span className="toc-chapter-label">
                    {chapter.index >= 0 ? `Ch ${chapter.index + 1}: ` : ""}
                    {chapter.title}
                  </span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {isExpanded && (
                  <ul className="toc-sections">
                    {chapter.sections.map((section) => {
                      const globalIdx = book.sections.indexOf(section);
                      const isActive = globalIdx === currentSectionIdx;
                      return (
                        <li key={section.id}>
                          <button
                            className={`toc-section-btn ${isActive ? "toc-section-active" : ""}`}
                            onClick={() => handleSectionClick(globalIdx, chapter.index)}
                            type="button"
                          >
                            <span className="toc-section-indicator" />
                            <span>{section.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

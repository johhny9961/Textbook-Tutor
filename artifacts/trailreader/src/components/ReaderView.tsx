import { useEffect, useRef, useCallback } from "react";
import type { BookSection } from "@/types";

const SCROLL_STORAGE_KEY = (sectionId: string) => `trailreader:scroll:${sectionId}`;

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

interface ReaderViewProps {
  section: BookSection;
  activeSentIdx: number;
  isPlaying: boolean;
}

export function ReaderView({ section, activeSentIdx, isPlaying }: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevSectionIdRef = useRef<string>("");
  const prevHighlightRef = useRef<Element | null>(null);

  const saveScroll = useCallback(
    debounce((sectionId: string, scrollTop: number) => {
      try {
        localStorage.setItem(SCROLL_STORAGE_KEY(sectionId), String(Math.round(scrollTop)));
      } catch {
        // ignore quota errors
      }
    }, 400),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => saveScroll(section.id, container.scrollTop);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [section.id, saveScroll]);

  useEffect(() => {
    if (prevSectionIdRef.current !== section.id) {
      const container = containerRef.current;
      if (container) {
        const saved = localStorage.getItem(SCROLL_STORAGE_KEY(section.id));
        const top = saved ? parseInt(saved, 10) : 0;
        container.scrollTo({ top, behavior: "instant" });
      }
      prevSectionIdRef.current = section.id;
      if (prevHighlightRef.current) {
        prevHighlightRef.current.classList.remove("tts-active");
        prevHighlightRef.current = null;
      }
    }
  }, [section.id]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    if (prevHighlightRef.current) {
      prevHighlightRef.current.classList.remove("tts-active");
      prevHighlightRef.current = null;
    }

    if (!isPlaying) return;

    const el = content.querySelector(`[data-sent-idx="${activeSentIdx}"]`);
    if (el) {
      el.classList.add("tts-active");
      prevHighlightRef.current = el;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSentIdx, isPlaying, section.id]);

  return (
    <div className="reader-scroll-area" ref={containerRef}>
      <article className="reader-article">
        <header className="reader-section-header">
          <p className="reader-chapter-label">{section.chapterTitle}</p>
          <h1 className="reader-section-title">{section.title}</h1>
        </header>

        <div
          ref={contentRef}
          className="reader-content prose-openstax"
          data-active-sent={isPlaying ? activeSentIdx : -1}
          dangerouslySetInnerHTML={{ __html: section.htmlContent }}
        />
      </article>
    </div>
  );
}

import { useEffect, useRef } from "react";
import type { BookSection } from "@/types";

interface ReaderViewProps {
  section: BookSection;
  activeParaIdx: number;
  isPlaying: boolean;
}

export function ReaderView({ section, activeParaIdx, isPlaying }: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevSectionIdRef = useRef<string>("");
  const prevHighlightRef = useRef<Element | null>(null);

  useEffect(() => {
    if (prevSectionIdRef.current !== section.id) {
      containerRef.current?.scrollTo({ top: 0, behavior: "instant" });
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

    const el = content.querySelector(`[data-para-idx="${activeParaIdx}"]`);
    if (el) {
      el.classList.add("tts-active");
      prevHighlightRef.current = el;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeParaIdx, isPlaying, section.id]);

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
          data-active-para={isPlaying ? activeParaIdx : -1}
          dangerouslySetInnerHTML={{ __html: section.htmlContent }}
        />
      </article>
    </div>
  );
}

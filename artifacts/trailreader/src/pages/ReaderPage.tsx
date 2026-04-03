import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Header } from "@/components/Header";
import { TOCDrawer } from "@/components/TOCDrawer";
import { ReaderView } from "@/components/ReaderView";
import { TTSControls } from "@/components/TTSControls";
import { TutorChat } from "@/components/TutorChat";
import { useTTS } from "@/hooks/useTTS";

export function ReaderPage() {
  const { book, sectionIdx, setSectionIdx, speed } = useApp();
  const [tocOpen, setTocOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [activeParaIdx, setActiveParaIdx] = useState(0);

  const currentSection = book?.sections[sectionIdx] ?? null;

  const { isPlaying, isPaused, paraIdx, play, pause, resume, stop, skipNext, skipPrev } = useTTS({
    paragraphs: currentSection?.paragraphs ?? [],
    speed,
    onParaChange: setActiveParaIdx,
    onEnd: () => {
      if (!book) return;
      const next = sectionIdx + 1;
      if (next < book.sections.length) {
        setSectionIdx(next);
        setActiveParaIdx(0);
      }
    },
  });

  const handleSectionSelect = useCallback((idx: number) => {
    stop();
    setSectionIdx(idx);
    setActiveParaIdx(0);
  }, [stop, setSectionIdx]);

  const totalSections = book?.sections.length ?? 0;
  const sectionProgress = totalSections > 0 ? ((sectionIdx + 1) / totalSections) * 100 : 0;

  if (!book || !currentSection) return null;

  return (
    <div className="reader-layout">
      <Header
        onMenuClick={() => setTocOpen(true)}
        chapterTitle={currentSection.chapterTitle}
        sectionTitle={currentSection.title}
        progress={sectionProgress}
      />

      <TOCDrawer
        isOpen={tocOpen}
        onClose={() => setTocOpen(false)}
        book={book}
        currentSectionIdx={sectionIdx}
        onSectionSelect={handleSectionSelect}
      />

      <main className="reader-main">
        <ReaderView
          section={currentSection}
          activeParaIdx={activeParaIdx}
          isPlaying={isPlaying}
        />
      </main>

      <div className="reader-bottom">
        <TTSControls
          isPlaying={isPlaying}
          isPaused={isPaused}
          paraIdx={paraIdx}
          totalParas={currentSection.paragraphs.length}
          onPlay={play}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          onSkipNext={skipNext}
          onSkipPrev={skipPrev}
        />

        <button
          className={`tutor-fab ${tutorOpen ? "tutor-fab-active" : ""}`}
          onClick={() => setTutorOpen(v => !v)}
          aria-label="Open Trail Guide tutor"
        >
          <MessageSquare size={20} />
          <span>Trail Guide</span>
        </button>
      </div>

      <TutorChat
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
        currentSection={currentSection}
      />
    </div>
  );
}

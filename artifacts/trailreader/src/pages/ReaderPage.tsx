import { useState, useCallback } from "react";
import { BookOpen, MessageSquare, ExternalLink } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Header } from "@/components/Header";
import { TOCDrawer } from "@/components/TOCDrawer";
import { ReaderView } from "@/components/ReaderView";
import { TTSControls } from "@/components/TTSControls";
import { TutorChat } from "@/components/TutorChat";
import { useTTS } from "@/hooks/useTTS";

export function ReaderPage() {
  const { book, sectionIdx, setSectionIdx, speed, oatEngineUrl } = useApp();
  const [tocOpen, setTocOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [activeSentIdx, setActiveSentIdx] = useState(0);
  const [activeParaIdx, setActiveParaIdx] = useState(0);

  const currentSection = book?.sections[sectionIdx] ?? null;
  const totalSections = book?.sections.length ?? 0;

  const { isPlaying, isPaused, sentIdx, play, pause, resume, stop, skipNext, skipPrev } = useTTS({
    sentences: currentSection?.sentences ?? [],
    speed,
    onSentenceChange: (si, pi) => {
      setActiveSentIdx(si);
      setActiveParaIdx(pi);
    },
    onEnd: () => {
      if (!book) return;
      const next = sectionIdx + 1;
      if (next < book.sections.length) {
        setSectionIdx(next);
        setActiveSentIdx(0);
        setActiveParaIdx(0);
      }
    },
  });

  const handleSectionSelect = useCallback((idx: number) => {
    stop();
    setSectionIdx(idx);
    setActiveSentIdx(0);
    setActiveParaIdx(0);
  }, [stop, setSectionIdx]);

  const sectionProgress = totalSections > 0 ? ((sectionIdx + 1) / totalSections) * 100 : 0;
  const sectionLabel = `${sectionIdx + 1} / ${totalSections}`;

  if (!book || !currentSection) return null;

  return (
    <div className="reader-layout">
      <Header
        onMenuClick={() => setTocOpen(true)}
        chapterTitle={currentSection.chapterTitle}
        sectionTitle={currentSection.title}
        sectionLabel={sectionLabel}
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
          activeSentIdx={activeSentIdx}
          isPlaying={isPlaying}
        />
      </main>

      <TTSControls
        isPlaying={isPlaying}
        isPaused={isPaused}
        sentIdx={sentIdx}
        totalSents={currentSection.sentences.length}
        onPlay={() => play()}
        onPause={pause}
        onResume={resume}
        onStop={stop}
        onSkipNext={skipNext}
        onSkipPrev={skipPrev}
      />

      <nav className="bottom-nav" aria-label="App navigation">
        <button
          className={`bottom-nav-tab ${!tutorOpen ? "bottom-nav-tab-active" : ""}`}
          onClick={() => setTutorOpen(false)}
          aria-label="Reader"
        >
          <BookOpen size={20} />
          <span>Reader</span>
        </button>

        <button
          className={`bottom-nav-tab ${tutorOpen ? "bottom-nav-tab-active" : ""}`}
          onClick={() => setTutorOpen(v => !v)}
          aria-label="Trail Guide tutor"
        >
          <MessageSquare size={20} />
          <span>Trail Guide</span>
        </button>

        {oatEngineUrl ? (
          <a
            href={oatEngineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bottom-nav-tab"
            aria-label="OAT Engine"
          >
            <ExternalLink size={20} />
            <span>OAT Engine</span>
          </a>
        ) : null}
      </nav>

      <TutorChat
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
        currentSection={currentSection}
      />
    </div>
  );
}

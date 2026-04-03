import { Play, Pause, Square, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useApp } from "@/context/AppContext";

interface TTSControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  sentIdx: number;
  totalSents: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
}

export function TTSControls({
  isPlaying,
  isPaused,
  sentIdx,
  totalSents,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipNext,
  onSkipPrev,
}: TTSControlsProps) {
  const { speed, setSpeed } = useApp();
  const progress = totalSents > 0 ? ((sentIdx + 1) / totalSents) * 100 : 0;
  const speedLabel = speed === 1.0 ? "1×" : `${speed.toFixed(1)}×`;

  return (
    <div className="tts-bar">
      <div className="tts-progress-strip">
        <div className="tts-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="tts-controls-row">
        <div className="tts-transport">
          <button
            className="tts-btn"
            onClick={onSkipPrev}
            aria-label="Previous sentence"
            disabled={sentIdx === 0}
          >
            <SkipBack size={18} />
          </button>

          {!isPlaying && !isPaused ? (
            <button className="tts-btn tts-btn-primary" onClick={onPlay} aria-label="Play">
              <Play size={22} />
            </button>
          ) : isPaused ? (
            <button className="tts-btn tts-btn-primary" onClick={onResume} aria-label="Resume">
              <Play size={22} />
            </button>
          ) : (
            <button className="tts-btn tts-btn-primary" onClick={onPause} aria-label="Pause">
              <Pause size={22} />
            </button>
          )}

          <button
            className="tts-btn"
            onClick={onSkipNext}
            aria-label="Next sentence"
            disabled={sentIdx >= totalSents - 1}
          >
            <SkipForward size={18} />
          </button>

          {(isPlaying || isPaused) && (
            <button className="tts-btn" onClick={onStop} aria-label="Stop">
              <Square size={16} />
            </button>
          )}
        </div>

        <div className="tts-speed-group">
          <Volume2 size={14} className="tts-speed-icon" />
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            className="tts-speed-slider"
            aria-label={`Playback speed: ${speedLabel}`}
          />
          <span className="tts-speed-label">{speedLabel}</span>
        </div>
      </div>

      <div className="tts-para-count">
        {sentIdx + 1} / {totalSents} sentences
      </div>
    </div>
  );
}

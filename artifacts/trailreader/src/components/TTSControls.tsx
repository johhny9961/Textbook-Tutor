import { Play, Pause, Square, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useApp } from "@/context/AppContext";

interface TTSControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  paraIdx: number;
  totalParas: number;
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
  paraIdx,
  totalParas,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipNext,
  onSkipPrev,
}: TTSControlsProps) {
  const { speed, setSpeed } = useApp();
  const progress = totalParas > 0 ? ((paraIdx + 1) / totalParas) * 100 : 0;

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpeed(parseFloat(e.target.value));
  };

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
            aria-label="Previous paragraph"
            disabled={paraIdx === 0}
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
            aria-label="Next paragraph"
            disabled={paraIdx >= totalParas - 1}
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
            onChange={handleSpeedChange}
            className="tts-speed-slider"
            aria-label={`Playback speed: ${speedLabel}`}
          />
          <span className="tts-speed-label">{speedLabel}</span>
        </div>
      </div>

      <div className="tts-para-count">
        {paraIdx + 1} / {totalParas}
      </div>
    </div>
  );
}

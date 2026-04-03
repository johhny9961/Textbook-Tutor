import { useState, useRef, useCallback, useEffect } from "react";

interface UseTTSOptions {
  paragraphs: string[];
  speed: number;
  onParaChange?: (idx: number) => void;
  onEnd?: () => void;
}

interface UseTTSReturn {
  isPlaying: boolean;
  isPaused: boolean;
  paraIdx: number;
  play: (fromIdx?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipNext: () => void;
  skipPrev: () => void;
}

export function useTTS({ paragraphs, speed, onParaChange, onEnd }: UseTTSOptions): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [paraIdx, setParaIdx] = useState(0);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentIdxRef = useRef(0);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const paragraphsRef = useRef(paragraphs);
  const speedRef = useRef(speed);

  useEffect(() => { paragraphsRef.current = paragraphs; }, [paragraphs]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (isPlaying && !isPaused) {
      synthRef.current?.cancel();
      playingRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [paragraphs]);

  const updateIdx = useCallback((idx: number) => {
    currentIdxRef.current = idx;
    setParaIdx(idx);
    onParaChange?.(idx);
  }, [onParaChange]);

  const speakFromIdx = useCallback((idx: number) => {
    const synth = synthRef.current;
    if (!synth) return;

    synth.cancel();
    playingRef.current = true;
    pausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    updateIdx(idx);

    const speakNext = (i: number) => {
      if (!playingRef.current || i >= paragraphsRef.current.length) {
        playingRef.current = false;
        setIsPlaying(false);
        setIsPaused(false);
        onEnd?.();
        return;
      }

      const text = paragraphsRef.current[i];
      if (!text?.trim()) {
        speakNext(i + 1);
        return;
      }

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = speedRef.current;
      utt.pitch = 1;
      utt.volume = 1;

      utt.onstart = () => {
        if (playingRef.current) {
          updateIdx(i);
        }
      };

      utt.onend = () => {
        if (playingRef.current && !pausedRef.current) {
          speakNext(i + 1);
        }
      };

      utt.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          speakNext(i + 1);
        }
      };

      synth.speak(utt);
    };

    speakNext(idx);
  }, [updateIdx, onEnd]);

  const play = useCallback((fromIdx?: number) => {
    const idx = fromIdx ?? currentIdxRef.current;
    speakFromIdx(idx);
  }, [speakFromIdx]);

  const pause = useCallback(() => {
    if (!synthRef.current) return;
    synthRef.current.pause();
    pausedRef.current = true;
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) return;

    if (synth.paused) {
      synth.resume();
      pausedRef.current = false;
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      speakFromIdx(currentIdxRef.current);
    }
  }, [speakFromIdx]);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
    playingRef.current = false;
    pausedRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const skipNext = useCallback(() => {
    const nextIdx = Math.min(currentIdxRef.current + 1, paragraphsRef.current.length - 1);
    if (playingRef.current) {
      speakFromIdx(nextIdx);
    } else {
      updateIdx(nextIdx);
    }
  }, [speakFromIdx, updateIdx]);

  const skipPrev = useCallback(() => {
    const prevIdx = Math.max(currentIdxRef.current - 1, 0);
    if (playingRef.current) {
      speakFromIdx(prevIdx);
    } else {
      updateIdx(prevIdx);
    }
  }, [speakFromIdx, updateIdx]);

  return { isPlaying, isPaused, paraIdx, play, pause, resume, stop, skipNext, skipPrev };
}

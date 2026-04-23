import { useState, useRef, useCallback, useEffect } from "react";
import type { Sentence } from "@/types";

interface UseTTSOptions {
  sentences: Sentence[];
  speed: number;
  onSentenceChange?: (sentIdx: number, paraIdx: number) => void;
  onEnd?: () => void;
}

interface UseTTSReturn {
  isPlaying: boolean;
  isPaused: boolean;
  sentIdx: number;
  paraIdx: number;
  play: (fromSentIdx?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipNext: () => void;
  skipPrev: () => void;
}

export function useTTS({ sentences, speed, onSentenceChange, onEnd }: UseTTSOptions): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sentIdx, setSentIdx] = useState(0);
  const [paraIdx, setParaIdx] = useState(0);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentSentIdxRef = useRef(0);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const sentencesRef = useRef(sentences);
  const speedRef = useRef(speed);

  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);
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
    playingRef.current = false;
    pausedRef.current = false;
    synthRef.current?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    currentSentIdxRef.current = 0;
    setSentIdx(0);
    setParaIdx(0);
  }, [sentences]);

  const updateSent = useCallback((si: number) => {
    currentSentIdxRef.current = si;
    const sent = sentencesRef.current[si];
    const pi = sent?.paraIdx ?? 0;
    setSentIdx(si);
    setParaIdx(pi);
    onSentenceChange?.(si, pi);
  }, [onSentenceChange]);

  const speakFromIdx = useCallback((si: number) => {
    const synth = synthRef.current;
    if (!synth || sentencesRef.current.length === 0) return;

    synth.cancel();
    playingRef.current = true;
    pausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    updateSent(si);

    const speakNext = (i: number) => {
      if (!playingRef.current || i >= sentencesRef.current.length) {
        playingRef.current = false;
        setIsPlaying(false);
        setIsPaused(false);
        onEnd?.();
        return;
      }

      const sent = sentencesRef.current[i];
      const text = sent?.text?.trim();
      if (!text) {
        setTimeout(() => speakNext(i + 1), 0);
        return;
      }

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = speedRef.current;
      utt.pitch = 1;
      utt.volume = 1;

      utt.onstart = () => {
        if (playingRef.current) updateSent(i);
      };

      utt.onboundary = (_e: SpeechSynthesisEvent) => {
        // Word boundary: highlight is already at sentence level.
        // Future: update a word-level overlay for finer-grained guidance.
      };

      utt.onend = () => {
        if (playingRef.current && !pausedRef.current) {
          speakNext(i + 1);
        }
      };

      utt.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          speakNext(i + 1);
        }
      };

      synth.speak(utt);
    };

    speakNext(si);
  }, [updateSent, onEnd]);

  const play = useCallback((fromSentIdx?: number) => {
    const si = fromSentIdx ?? currentSentIdxRef.current;
    speakFromIdx(si);
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
      speakFromIdx(currentSentIdxRef.current);
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
    if (sentencesRef.current.length === 0) return;
    const nextIdx = Math.min(currentSentIdxRef.current + 1, sentencesRef.current.length - 1);
    if (playingRef.current) {
      speakFromIdx(nextIdx);
    } else {
      updateSent(nextIdx);
    }
  }, [speakFromIdx, updateSent]);

  const skipPrev = useCallback(() => {
    if (sentencesRef.current.length === 0) return;
    const prevIdx = Math.max(currentSentIdxRef.current - 1, 0);
    if (playingRef.current) {
      speakFromIdx(prevIdx);
    } else {
      updateSent(prevIdx);
    }
  }, [speakFromIdx, updateSent]);

  return { isPlaying, isPaused, sentIdx, paraIdx, play, pause, resume, stop, skipNext, skipPrev };
}

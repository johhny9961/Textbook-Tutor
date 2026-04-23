import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { BookData } from "@/types";

const NS = "trailreader:";

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (key === "book" && parsed !== null) {
      if (!parsed || !Array.isArray(parsed.sections)) return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed to save to localStorage:", key, e);
  }
}

interface AppContextValue {
  book: BookData | null;
  sectionIdx: number;
  speed: number;
  oatEngineUrl: string;
  setBook: (book: BookData | null) => void;
  setSectionIdx: (idx: number) => void;
  setSpeed: (speed: number) => void;
  setOatEngineUrl: (url: string) => void;
  clearBook: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [book, setBookState] = useState<BookData | null>(() => loadLS<BookData | null>("book", null));
  const [sectionIdx, setSectionIdxState] = useState<number>(() => loadLS<number>("position", 0));
  const [speed, setSpeedState] = useState<number>(() => loadLS<number>("speed", 1.0));
  const [oatEngineUrl, setOatEngineUrlState] = useState<string>(() => loadLS<string>("oatEngineUrl", ""));

  const setBook = useCallback((b: BookData | null) => {
    setBookState(b);
    saveLS("book", b);
    setSectionIdxState(0);
    saveLS("position", 0);
  }, []);

  const setSectionIdx = useCallback((idx: number) => {
    setSectionIdxState(idx);
    saveLS("position", idx);
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    saveLS("speed", s);
  }, []);

  const setOatEngineUrl = useCallback((url: string) => {
    setOatEngineUrlState(url);
    saveLS("oatEngineUrl", url);
  }, []);

  const clearBook = useCallback(() => {
    setBookState(null);
    saveLS("book", null);
    setSectionIdxState(0);
    saveLS("position", 0);
  }, []);

  return (
    <AppContext.Provider
      value={{ book, sectionIdx, speed, oatEngineUrl, setBook, setSectionIdx, setSpeed, setOatEngineUrl, clearBook }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

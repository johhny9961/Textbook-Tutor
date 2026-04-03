export interface BookSection {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  sectionIndex: number;
  title: string;
  htmlContent: string;
  paragraphs: string[];
}

export interface BookChapter {
  index: number;
  title: string;
  sections: BookSection[];
}

export interface BookData {
  name: string;
  chapters: BookChapter[];
  sections: BookSection[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  paraIndex: number;
  speed: number;
}

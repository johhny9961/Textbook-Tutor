export interface Sentence {
  text: string;
  paraIdx: number;
  sentIdx: number;
}

export interface BookSection {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  sectionIndex: number;
  title: string;
  htmlContent: string;
  paragraphs: string[];
  sentences: Sentence[];
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

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function tokenizeSentences(text: string): string[] {
  if (!text.trim()) return [];
  const parts = text.trim().split(/(?<=[.!?])\s+(?=[A-Z"'])/);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function instrumentParagraphs(
  paragraphTexts: string[],
  minLength = 10
): { htmlContent: string; paragraphs: string[]; sentences: Sentence[] } {
  const paragraphs: string[] = [];
  const sentences: Sentence[] = [];
  let paraIdx = 0;
  let sentIdx = 0;
  const htmlParts: string[] = [];

  for (const text of paragraphTexts) {
    if (text.length <= minLength) continue;
    const currentParaIdx = paraIdx++;
    paragraphs.push(text);

    const sentTexts = tokenizeSentences(text);

    if (sentTexts.length > 1) {
      const spans = sentTexts.map((s) => {
        const idx = sentIdx++;
        sentences.push({ text: s, paraIdx: currentParaIdx, sentIdx: idx });
        return `<span data-sent-idx="${idx}">${escapeHtml(s)}</span>`;
      });
      htmlParts.push(`<p data-para-idx="${currentParaIdx}">${spans.join(" ")}</p>`);
    } else {
      const idx = sentIdx++;
      sentences.push({ text, paraIdx: currentParaIdx, sentIdx: idx });
      htmlParts.push(`<p data-para-idx="${currentParaIdx}"><span data-sent-idx="${idx}">${escapeHtml(text)}</span></p>`);
    }
  }

  return {
    htmlContent: htmlParts.join("\n"),
    paragraphs,
    sentences,
  };
}

export function extractParagraphsFromHtml(html: string, minLength = 10): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = stripHtmlTags(match[1])
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > minLength) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

export async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "TrailReader/1.0 (educational textbook reader)" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Should not reach here");
}

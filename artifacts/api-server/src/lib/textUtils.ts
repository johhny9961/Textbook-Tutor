export interface Sentence {
  text: string;
  paraIdx: number;
  sentIdx: number;
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
  const parts = text.trim().split(/(?<=(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|Vol|Fig|eq|Eq|al|etc))[.!?])\s+(?=[A-Z"'])/);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function instrumentParagraphs(
  paragraphTexts: string[]
): { htmlContent: string; paragraphs: string[]; sentences: Sentence[] } {
  const paragraphs: string[] = [];
  const sentences: Sentence[] = [];
  let paraIdx = 0;
  let sentIdx = 0;
  const htmlParts: string[] = [];

  for (const text of paragraphTexts) {
    if (text.length <= 20) continue;
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

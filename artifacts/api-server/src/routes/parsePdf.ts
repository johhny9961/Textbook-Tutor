import { Router } from "express";
import multer from "multer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";

const pdfRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

interface Sentence {
  text: string;
  paraIdx: number;
  sentIdx: number;
}

interface BookSection {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  sectionIndex: number;
  title: string;
  htmlContent: string;
  paragraphs: string[];
  sentences: Sentence[];
}

interface BookChapter {
  index: number;
  title: string;
  sections: BookSection[];
}

interface BookData {
  name: string;
  chapters: BookChapter[];
  sections: BookSection[];
}

interface TextBlock {
  text: string;
  fontSize: number;
  page: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenizeSentences(text: string): string[] {
  if (!text.trim()) return [];
  const parts = text.trim().split(/(?<=[.!?])\s+(?=[A-Z"'])/);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

function isChapterHeading(text: string): boolean {
  return /^(chapter|unit)\s+\d+/i.test(text.trim());
}

function isSectionHeading(text: string): boolean {
  return /^\d+\.\d+\s+\S/.test(text.trim());
}

function isLikelyHeading(text: string, fontSize: number, bodySize: number): boolean {
  if (fontSize > bodySize * 1.3) return true;
  if (isChapterHeading(text) || isSectionHeading(text)) return true;
  return false;
}

function isLikelyChapterLevel(text: string, fontSize: number, bodySize: number): boolean {
  if (isChapterHeading(text)) return true;
  if (fontSize > bodySize * 1.7) return true;
  return false;
}

async function extractTextBlocks(pdfData: Uint8Array): Promise<TextBlock[]> {
  const doc = await getDocument({
    data: pdfData,
    useSystemFonts: true,
  }).promise;

  const blocks: TextBlock[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    let currentLine = "";
    let currentFontSize = 0;
    let lastY: number | null = null;

    for (const item of content.items) {
      const textItem = item as TextItem;
      if (!textItem.str) continue;

      const fontSize = Math.abs(textItem.transform[3]);
      const y = textItem.transform[5];

      const isNewLine = lastY !== null && Math.abs(y - lastY) > fontSize * 0.5;

      if (isNewLine && currentLine.trim()) {
        blocks.push({
          text: currentLine.trim().replace(/\s+/g, " "),
          fontSize: currentFontSize,
          page: pageNum,
        });
        currentLine = "";
        currentFontSize = 0;
      }

      currentLine += textItem.str;
      if (fontSize > currentFontSize) currentFontSize = fontSize;
      lastY = y;
    }

    if (currentLine.trim()) {
      blocks.push({
        text: currentLine.trim().replace(/\s+/g, " "),
        fontSize: currentFontSize,
        page: pageNum,
      });
    }

    page.cleanup();
  }

  doc.destroy();
  return blocks;
}

function findBodyFontSize(blocks: TextBlock[]): number {
  const sizeCounts = new Map<number, number>();
  for (const b of blocks) {
    if (b.text.length < 30) continue;
    const rounded = Math.round(b.fontSize * 2) / 2;
    sizeCounts.set(rounded, (sizeCounts.get(rounded) || 0) + b.text.length);
  }

  let maxCount = 0;
  let bodySize = 10;
  for (const [size, count] of sizeCounts) {
    if (count > maxCount) {
      maxCount = count;
      bodySize = size;
    }
  }
  return bodySize;
}

function instrumentParagraphs(
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

function buildBookData(blocks: TextBlock[], fileName: string): BookData {
  if (blocks.length === 0) {
    return { name: fileName, chapters: [], sections: [] };
  }

  const bodySize = findBodyFontSize(blocks);
  const chapters: BookChapter[] = [];
  const allSections: BookSection[] = [];

  let chapterIdx = 0;
  let sectionIdx = 0;
  let currentChapterTitle = "Content";
  let currentSectionTitle = "Introduction";
  let currentParagraphs: string[] = [];
  let currentChapterSections: BookSection[] = [];
  let hasEmittedChapter = false;

  function flushSection() {
    if (currentParagraphs.length === 0) return;

    const { htmlContent, paragraphs, sentences } =
      instrumentParagraphs(currentParagraphs);

    if (paragraphs.length === 0) {
      currentParagraphs = [];
      return;
    }

    const section: BookSection = {
      id: `s-${chapterIdx}-${sectionIdx}`,
      chapterIndex: chapterIdx,
      chapterTitle: currentChapterTitle,
      sectionIndex: sectionIdx,
      title: currentSectionTitle,
      htmlContent,
      paragraphs,
      sentences,
    };
    allSections.push(section);
    currentChapterSections.push(section);
    sectionIdx++;
    currentParagraphs = [];
  }

  function flushChapter() {
    flushSection();
    if (currentChapterSections.length > 0) {
      chapters.push({
        index: chapterIdx,
        title: currentChapterTitle,
        sections: [...currentChapterSections],
      });
      currentChapterSections = [];
      hasEmittedChapter = true;
    }
  }

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;

    if (text.length < 200 && isLikelyHeading(text, block.fontSize, bodySize)) {
      if (isLikelyChapterLevel(text, block.fontSize, bodySize)) {
        flushChapter();
        if (hasEmittedChapter) chapterIdx++;
        currentChapterTitle = text;
        currentSectionTitle = text;
        sectionIdx = 0;
      } else {
        flushSection();
        currentSectionTitle = text;
      }
    } else {
      currentParagraphs.push(text);
    }
  }

  flushChapter();

  if (chapters.length === 0 && allSections.length === 0) {
    const allText = blocks.map((b) => b.text).filter((t) => t.length > 20);
    const CHUNK = 30;
    for (let i = 0; i < Math.ceil(allText.length / CHUNK); i++) {
      const chunk = allText.slice(i * CHUNK, (i + 1) * CHUNK);
      const { htmlContent, paragraphs, sentences } =
        instrumentParagraphs(chunk);

      if (paragraphs.length === 0) continue;

      const section: BookSection = {
        id: `s-0-${i}`,
        chapterIndex: 0,
        chapterTitle: "Content",
        sectionIndex: i,
        title: `Part ${i + 1}`,
        htmlContent,
        paragraphs,
        sentences,
      };
      allSections.push(section);
    }
    if (allSections.length > 0) {
      chapters.push({ index: 0, title: "Content", sections: [...allSections] });
    }
  }

  return {
    name: fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
    chapters,
    sections: allSections,
  };
}

pdfRouter.post("/parse-pdf", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    if (file.mimetype !== "application/pdf" && !file.originalname.endsWith(".pdf")) {
      res.status(400).json({ error: "Only PDF files are accepted." });
      return;
    }

    const pdfData = new Uint8Array(file.buffer);

    let blocks: TextBlock[];
    try {
      blocks = await extractTextBlocks(pdfData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("password")) {
        res.status(422).json({ error: "This PDF is password-protected. Please use an unprotected PDF." });
        return;
      }
      throw err;
    }

    if (blocks.length === 0) {
      res.status(422).json({
        error: "Could not extract any text from this PDF. It may be a scanned document or image-only PDF.",
      });
      return;
    }

    const bookData = buildBookData(blocks, file.originalname);

    if (bookData.sections.length === 0) {
      res.status(422).json({ error: "No readable content found in this PDF." });
      return;
    }

    res.json(bookData);
  } catch (err) {
    req.log?.error({ err }, "PDF parse error");
    res.status(500).json({ error: "Failed to parse PDF. Please try a different file." });
  }
});

export default pdfRouter;

import DOMPurify from "dompurify";
import type { BookData, BookChapter, BookSection } from "@/types";

const BLOCK_TAGS = new Set([
  "P", "LI", "DD", "DT", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "H4", "H5", "H6",
  "FIGCAPTION", "CAPTION", "TD", "TH",
]);

function extractParagraphs(el: Element): string[] {
  const paras: string[] = [];
  function walk(node: Element) {
    if (BLOCK_TAGS.has(node.tagName)) {
      const text = node.textContent?.trim().replace(/\s+/g, " ") || "";
      if (text.length > 20) paras.push(text);
    } else {
      for (const child of Array.from(node.children)) {
        walk(child as Element);
      }
    }
  }
  walk(el);
  return paras;
}

function instrumentHTML(el: Element): string {
  let idx = 0;
  function walk(node: Element) {
    if (BLOCK_TAGS.has(node.tagName)) {
      const text = node.textContent?.trim().replace(/\s+/g, " ") || "";
      if (text.length > 20) {
        node.setAttribute("data-para-idx", String(idx++));
      }
    }
    for (const child of Array.from(node.children)) {
      walk(child as Element);
    }
  }
  walk(el);
  return el.innerHTML;
}

function cleanTitle(el: Element | null): string {
  return el?.textContent?.trim().replace(/\s+/g, " ") || "Untitled";
}

export function parseOpenStaxHTML(rawHtml: string, fileName: string): BookData {
  const clean = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "link", "meta", "iframe"],
    FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "style"],
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, "text/html");

  const sections: BookSection[] = [];
  const chapters: BookChapter[] = [];

  const h1Elements = doc.querySelectorAll("h1, [data-type='chapter'] > [data-type='title']");

  if (h1Elements.length > 0) {
    parseWithHeadings(doc, sections, chapters);
  } else {
    parseFlatContent(doc, sections, chapters, fileName);
  }

  if (sections.length === 0) {
    const allText = doc.body?.textContent?.trim() || "";
    const fallbackSection: BookSection = {
      id: "s-0-0",
      chapterIndex: 0,
      chapterTitle: "Content",
      sectionIndex: 0,
      title: "Full Document",
      htmlContent: doc.body?.innerHTML || rawHtml,
      paragraphs: allText.split(/\n\n+/).filter(t => t.trim().length > 0).slice(0, 500),
    };
    sections.push(fallbackSection);
    chapters.push({ index: 0, title: "Content", sections: [fallbackSection] });
  }

  return {
    name: fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
    chapters,
    sections,
  };
}

function parseWithHeadings(
  doc: Document,
  sections: BookSection[],
  chapters: BookChapter[]
) {
  const body = doc.body;
  if (!body) return;

  let chapterIdx = -1;
  let sectionIdx = 0;
  let currentChapterTitle = "Introduction";
  let currentChapterSections: BookSection[] = [];

  const allNodes = Array.from(body.querySelectorAll("*"));
  const headingSet = new Set<Element>();

  const h1s = body.querySelectorAll("h1, [data-type='chapter-title'], [data-type='title'][data-level='1']");
  const h2s = body.querySelectorAll("h2, [data-type='section-title'], [data-type='title'][data-level='2']");
  const h3s = body.querySelectorAll("h3, [data-type='subsection-title']");

  const allHeadings = [...h1s, ...h2s, ...h3s].sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  allHeadings.forEach(h => headingSet.add(h));

  if (allHeadings.length === 0) {
    parseFlatContent(doc, sections, chapters, "Document");
    return;
  }

  function flushSection(
    sectionTitle: string,
    contentEl: Element,
    chI: number,
    chTitle: string,
    secI: number
  ) {
    const paragraphs = extractParagraphs(contentEl);
    const htmlContent = instrumentHTML(contentEl);
    if (paragraphs.length === 0 && htmlContent.trim().length < 50) return;

    const section: BookSection = {
      id: `s-${chI}-${secI}`,
      chapterIndex: chI,
      chapterTitle: chTitle,
      sectionIndex: secI,
      title: sectionTitle,
      htmlContent,
      paragraphs,
    };
    sections.push(section);
    currentChapterSections.push(section);
  }

  let currentContainer = doc.createElement("div");
  let currentSectionTitle = "Introduction";
  let isChapterLevel = false;

  for (let i = 0; i < allHeadings.length; i++) {
    const heading = allHeadings[i];
    const isH1 = heading.tagName === "H1" || heading.getAttribute("data-level") === "1";

    if (isH1) {
      if (currentContainer.childNodes.length > 0) {
        flushSection(currentSectionTitle, currentContainer, chapterIdx, currentChapterTitle, sectionIdx++);
      }

      if (currentChapterSections.length > 0) {
        chapters.push({
          index: chapterIdx,
          title: currentChapterTitle,
          sections: [...currentChapterSections],
        });
        currentChapterSections = [];
      }

      chapterIdx++;
      currentChapterTitle = cleanTitle(heading);
      currentContainer = doc.createElement("div");
      currentSectionTitle = currentChapterTitle;
      sectionIdx = 0;
      isChapterLevel = true;
    } else {
      if (isChapterLevel && currentContainer.childNodes.length > 0) {
        flushSection(currentSectionTitle, currentContainer, chapterIdx, currentChapterTitle, sectionIdx++);
        currentContainer = doc.createElement("div");
      }
      if (!isChapterLevel && currentContainer.childNodes.length > 0) {
        flushSection(currentSectionTitle, currentContainer, chapterIdx, currentChapterTitle, sectionIdx++);
        currentContainer = doc.createElement("div");
      }
      currentSectionTitle = cleanTitle(heading);
      isChapterLevel = false;
    }

    let next = heading.nextElementSibling;
    while (next && !headingSet.has(next)) {
      const clone = next.cloneNode(true) as Element;
      currentContainer.appendChild(clone);
      next = next.nextElementSibling;
    }
  }

  if (currentContainer.childNodes.length > 0) {
    flushSection(currentSectionTitle, currentContainer, chapterIdx, currentChapterTitle, sectionIdx);
  }

  if (currentChapterSections.length > 0) {
    chapters.push({
      index: chapterIdx,
      title: currentChapterTitle,
      sections: [...currentChapterSections],
    });
  }
}

function parseFlatContent(
  doc: Document,
  sections: BookSection[],
  chapters: BookChapter[],
  fileName: string
) {
  const body = doc.body;
  if (!body) return;

  const chapterTitle = fileName;
  const chapterSections: BookSection[] = [];

  const paras = extractParagraphs(body);
  const CHUNK_SIZE = 30;

  for (let i = 0; i < Math.ceil(paras.length / CHUNK_SIZE); i++) {
    const chunk = paras.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const container = doc.createElement("div");

    chunk.forEach((text, j) => {
      const p = doc.createElement("p");
      p.textContent = text;
      p.setAttribute("data-para-idx", String(j));
      container.appendChild(p);
    });

    const section: BookSection = {
      id: `s-0-${i}`,
      chapterIndex: 0,
      chapterTitle,
      sectionIndex: i,
      title: `Part ${i + 1}`,
      htmlContent: container.innerHTML,
      paragraphs: chunk,
    };
    sections.push(section);
    chapterSections.push(section);
  }

  if (chapterSections.length > 0) {
    chapters.push({ index: 0, title: chapterTitle, sections: chapterSections });
  }
}

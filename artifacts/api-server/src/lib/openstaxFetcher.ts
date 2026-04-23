import { db } from "@workspace/db";
import { books, bookChapters, bookSections } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

interface TOCEntry {
  title: string;
  slug: string;
  contents?: TOCEntry[];
}

interface Sentence {
  text: string;
  paraIdx: number;
  sentIdx: number;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
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

function instrumentParagraphs(
  paragraphTexts: string[]
): { htmlContent: string; paragraphs: string[]; sentences: Sentence[] } {
  const paragraphs: string[] = [];
  const sentences: Sentence[] = [];
  let paraIdx = 0;
  let sentIdx = 0;
  const htmlParts: string[] = [];

  for (const text of paragraphTexts) {
    if (text.length <= 10) continue;
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

function extractParagraphsFromHtml(html: string): string[] {
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
    if (text.length > 10) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
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

function extractPreloadedState(html: string): Record<string, unknown> | null {
  const marker = "window.__PRELOADED_STATE__ = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + marker.length;
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  if (endIdx === -1) return null;

  try {
    return JSON.parse(html.slice(jsonStart, endIdx));
  } catch {
    return null;
  }
}

function extractPageContent(html: string): string {
  const marker = 'data-book-content="true">';
  const idx = html.indexOf(marker);
  if (idx === -1) return "";

  const contentStart = idx + marker.length;
  let depth = 1;
  let i = contentStart;

  while (i < html.length && depth > 0) {
    if (html[i] === "<") {
      if (html.startsWith("</div", i)) {
        depth--;
        if (depth === 0) break;
      } else if (html.startsWith("<div", i)) {
        depth++;
      }
    }
    i++;
  }

  return html.slice(contentStart, i);
}

export function parseBookSlug(input: string): string | null {
  const cleaned = input.trim();

  const urlMatch = cleaned.match(/openstax\.org\/books\/([^/]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[a-z0-9-]+$/.test(cleaned)) return cleaned;

  return null;
}

interface FlatTOCEntry {
  chapterIndex: number;
  chapterTitle: string;
  sectionIndex: number;
  sectionTitle: string;
  slug: string;
}

function flattenTOC(tree: TOCEntry[]): FlatTOCEntry[] {
  const entries: FlatTOCEntry[] = [];
  let chapterIndex = 0;

  for (const item of tree) {
    const chTitle = stripHtmlTags(item.title);

    if (item.contents && item.contents.length > 0) {
      let sectionIndex = 0;
      for (const section of item.contents) {
        if (section.contents && section.contents.length > 0) {
          for (const subsec of section.contents) {
            entries.push({
              chapterIndex,
              chapterTitle: chTitle,
              sectionIndex: sectionIndex++,
              sectionTitle: stripHtmlTags(subsec.title),
              slug: subsec.slug,
            });
          }
        } else {
          entries.push({
            chapterIndex,
            chapterTitle: chTitle,
            sectionIndex: sectionIndex++,
            sectionTitle: stripHtmlTags(section.title),
            slug: section.slug,
          });
        }
      }
      chapterIndex++;
    } else {
      entries.push({
        chapterIndex,
        chapterTitle: chTitle,
        sectionIndex: 0,
        sectionTitle: chTitle,
        slug: item.slug,
      });
      chapterIndex++;
    }
  }

  return entries;
}

export async function importOpenStaxBook(bookSlug: string, bookId: number): Promise<void> {
  const log = logger.child({ bookSlug, bookId });

  try {
    log.info("Starting OpenStax book import");

    const firstPageUrl = `https://openstax.org/books/${bookSlug}/pages/preface`;
    let html: string;
    try {
      html = await fetchWithRetry(firstPageUrl);
    } catch {
      const altUrl = `https://openstax.org/books/${bookSlug}/pages/1-introduction`;
      html = await fetchWithRetry(altUrl);
    }

    const state = extractPreloadedState(html);
    if (!state) {
      throw new Error("Could not extract book data from OpenStax page");
    }

    const book = (state as { content?: { book?: Record<string, unknown> } }).content?.book;
    if (!book) {
      throw new Error("No book data found in page");
    }

    const tree = (book as { tree?: { contents?: TOCEntry[] } }).tree?.contents;
    if (!tree || tree.length === 0) {
      throw new Error("No table of contents found");
    }

    const bookTitle = (book as { title?: string }).title || bookSlug;
    const flatEntries = flattenTOC(tree);

    await db
      .update(books)
      .set({
        title: bookTitle,
        totalSections: flatEntries.length,
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId));

    log.info({ totalSections: flatEntries.length }, "TOC parsed, starting section imports");

    await db.delete(bookSections).where(eq(bookSections.bookId, bookId));
    await db.delete(bookChapters).where(eq(bookChapters.bookId, bookId));

    const chapterMap = new Map<number, number>();
    let successfulSections = 0;
    let failedSections = 0;

    for (let i = 0; i < flatEntries.length; i++) {
      const entry = flatEntries[i];

      try {
        if (!chapterMap.has(entry.chapterIndex)) {
          const [inserted] = await db
            .insert(bookChapters)
            .values({
              bookId,
              index: entry.chapterIndex,
              title: entry.chapterTitle,
            })
            .onConflictDoNothing()
            .returning();

          if (inserted) {
            chapterMap.set(entry.chapterIndex, inserted.id);
          } else {
            const existing = await db.query.bookChapters.findFirst({
              where: (ch, { and, eq: eq_ }) =>
                and(eq_(ch.bookId, bookId), eq_(ch.index, entry.chapterIndex)),
            });
            if (existing) chapterMap.set(entry.chapterIndex, existing.id);
          }
        }

        const chapterId = chapterMap.get(entry.chapterIndex);
        if (!chapterId) {
          log.warn({ entry }, "Could not find chapter ID, skipping section");
          failedSections++;
          continue;
        }

        const pageUrl = `https://openstax.org/books/${bookSlug}/pages/${entry.slug}`;
        const pageHtml = await fetchWithRetry(pageUrl);
        const contentHtml = extractPageContent(pageHtml);

        const rawParagraphs = extractParagraphsFromHtml(contentHtml);
        const { htmlContent, paragraphs, sentences } = instrumentParagraphs(rawParagraphs);

        const sectionId = `s-${entry.chapterIndex}-${entry.sectionIndex}`;

        if (paragraphs.length > 0) {
          await db
            .insert(bookSections)
            .values({
              bookId,
              chapterId,
              chapterIndex: entry.chapterIndex,
              sectionIndex: entry.sectionIndex,
              sectionId,
              title: entry.sectionTitle,
              chapterTitle: entry.chapterTitle,
              htmlContent,
              paragraphs,
              sentences,
            })
            .onConflictDoNothing();
        }

        successfulSections++;

        await db
          .update(books)
          .set({
            importedSections: i + 1,
            updatedAt: new Date(),
          })
          .where(eq(books.id, bookId));

        if (i % 10 === 0) {
          log.info({ progress: `${i + 1}/${flatEntries.length}`, successful: successfulSections, failed: failedSections }, "Import progress");
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        failedSections++;
        log.warn({ err, slug: entry.slug }, "Failed to import section, continuing");
      }
    }

    const failureRate = flatEntries.length > 0 ? failedSections / flatEntries.length : 0;
    if (failureRate > 0.5) {
      await db
        .update(books)
        .set({
          status: "error",
          errorMessage: `Import partially failed: ${failedSections}/${flatEntries.length} sections could not be imported.`,
          importedSections: flatEntries.length,
          updatedAt: new Date(),
        })
        .where(eq(books.id, bookId));
      log.error({ failedSections, total: flatEntries.length }, "Import failed — too many section failures");
      return;
    }

    await db
      .update(books)
      .set({
        status: "ready",
        importedSections: flatEntries.length,
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId));

    log.info("Book import complete");
  } catch (err) {
    log.error({ err }, "Book import failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(books)
      .set({
        status: "error",
        errorMessage: msg,
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId));
  }
}

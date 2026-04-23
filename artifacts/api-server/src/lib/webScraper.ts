import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import {
  fetchWithRetry,
  instrumentParagraphs,
  type BookData,
  type BookSection,
  type BookChapter,
} from "./textProcessing";
import { logger } from "./logger";

const BLOCK_TAGS = new Set([
  "P", "LI", "DD", "DT", "BLOCKQUOTE", "PRE",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "FIGCAPTION", "CAPTION", "TD", "TH",
]);

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT_MS = 500;

interface ScrapedPage {
  url: string;
  title: string;
  paragraphs: string[];
}

function isPrivateIp(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  if (hostname === "localhost" || hostname === "::1") return true;
  if (hostname.startsWith("fc") || hostname.startsWith("fd")) return true;
  return false;
}

function validateUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  if (isPrivateIp(url.hostname)) {
    throw new Error("Cannot scrape private/internal addresses");
  }
  return url;
}

function extractParagraphsFromDom(doc: Document): string[] {
  const paragraphs: string[] = [];

  function walk(node: Element, depth = 0) {
    if (depth > 100) return;
    if (BLOCK_TAGS.has(node.tagName)) {
      const text = (node.textContent?.trim() || "").replace(/\s+/g, " ");
      if (text.length > 10) paragraphs.push(text);
    } else {
      for (const child of Array.from(node.children)) {
        walk(child as Element, depth + 1);
      }
    }
  }

  if (doc.body) walk(doc.body);
  return paragraphs;
}

async function scrapeSinglePage(url: string): Promise<ScrapedPage> {
  const validated = validateUrl(url);
  const html = await fetchWithRetry(validated.href);

  if (html.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Response too large (${(html.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  const dom = new JSDOM(html, { url: validated.href });
  const reader = new Readability(dom.window.document.cloneNode(true) as Document);
  const article = reader.parse();

  if (!article || !article.content) {
    throw new Error("Could not extract readable content from this page");
  }

  const contentDom = new JSDOM(article.content);
  const paragraphs = extractParagraphsFromDom(contentDom.window.document);

  return {
    url: validated.href,
    title: article.title || validated.hostname,
    paragraphs,
  };
}

function discoverLinks(html: string, baseUrl: string, selector?: string): string[] {
  const dom = new JSDOM(html, { url: baseUrl });
  const doc = dom.window.document;
  const base = new URL(baseUrl);

  const linkEls = selector
    ? doc.querySelectorAll(selector)
    : doc.querySelectorAll("a[href]");

  const urls = new Set<string>();
  for (const el of linkEls) {
    const href = el.getAttribute("href");
    if (!href) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin === base.origin && resolved.pathname !== base.pathname) {
        resolved.hash = "";
        urls.add(resolved.href);
      }
    } catch {
      // invalid URL
    }
  }
  return Array.from(urls);
}

export async function scrapeUrl(url: string): Promise<BookData> {
  const page = await scrapeSinglePage(url);

  if (page.paragraphs.length === 0) {
    throw new Error("No readable paragraphs found on this page");
  }

  return singlePageToBookData(page);
}

export async function scrapeMultiPage(
  url: string,
  linkSelector?: string,
  maxPages = 20
): Promise<BookData> {
  const cap = Math.min(maxPages, 50);
  const validated = validateUrl(url);
  const html = await fetchWithRetry(validated.href);

  if (html.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Response too large`);
  }

  const links = discoverLinks(html, validated.href, linkSelector || undefined);
  const pageUrls = [validated.href, ...links.slice(0, cap - 1)];

  const log = logger.child({ scrapeUrl: url, totalPages: pageUrls.length });
  log.info("Starting multi-page scrape");

  const pages: ScrapedPage[] = [];
  for (const pageUrl of pageUrls) {
    try {
      const page = await scrapeSinglePage(pageUrl);
      if (page.paragraphs.length > 0) {
        pages.push(page);
      }
    } catch (err) {
      log.warn({ err, pageUrl }, "Failed to scrape page, skipping");
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  if (pages.length === 0) {
    throw new Error("Could not extract content from any of the discovered pages");
  }

  return multiPageToBookData(pages);
}

function singlePageToBookData(page: ScrapedPage): BookData {
  const CHUNK_SIZE = 30;
  const sections: BookSection[] = [];
  const numChunks = Math.ceil(page.paragraphs.length / CHUNK_SIZE);

  for (let i = 0; i < numChunks; i++) {
    const chunk = page.paragraphs.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const { htmlContent, paragraphs, sentences } = instrumentParagraphs(chunk);
    if (paragraphs.length === 0) continue;

    sections.push({
      id: `s-0-${i}`,
      chapterIndex: 0,
      chapterTitle: page.title,
      sectionIndex: i,
      title: numChunks > 1 ? `Part ${i + 1}` : page.title,
      htmlContent,
      paragraphs,
      sentences,
    });
  }

  return {
    name: page.title,
    chapters: sections.length > 0
      ? [{ index: 0, title: page.title, sections }]
      : [],
    sections,
  };
}

function multiPageToBookData(pages: ScrapedPage[]): BookData {
  const sections: BookSection[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { htmlContent, paragraphs, sentences } = instrumentParagraphs(page.paragraphs);
    if (paragraphs.length === 0) continue;

    sections.push({
      id: `s-0-${i}`,
      chapterIndex: 0,
      chapterTitle: pages[0].title,
      sectionIndex: i,
      title: page.title,
      htmlContent,
      paragraphs,
      sentences,
    });
  }

  const title = pages[0]?.title || "Scraped Content";
  return {
    name: title,
    chapters: sections.length > 0
      ? [{ index: 0, title, sections }]
      : [],
    sections,
  };
}

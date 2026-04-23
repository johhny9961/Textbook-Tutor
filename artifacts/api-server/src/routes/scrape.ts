import { Router } from "express";
import { scrapeUrl, scrapeMultiPage } from "../lib/webScraper";

const scrapeRouter = Router();

const ipLastScrape = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const maxRequests = 10;

  let timestamps = ipLastScrape.get(ip) || [];
  timestamps = timestamps.filter((t) => now - t < window);
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  ipLastScrape.set(ip, timestamps);
  return true;
}

scrapeRouter.post("/scrape", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests. Please wait a minute." });
      return;
    }

    const { url } = req.body as { url?: string };
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Please provide a URL." });
      return;
    }

    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid URL format." });
      return;
    }

    const bookData = await scrapeUrl(url);

    if (bookData.sections.length === 0) {
      res.status(422).json({ error: "No readable content found on this page." });
      return;
    }

    res.json(bookData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log?.error({ err }, "Scrape failed");

    if (msg.includes("private") || msg.includes("Only http")) {
      res.status(400).json({ error: msg });
      return;
    }

    res.status(500).json({ error: `Failed to scrape page: ${msg}` });
  }
});

scrapeRouter.post("/scrape/multi", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests. Please wait a minute." });
      return;
    }

    const { url, linkSelector, maxPages } = req.body as {
      url?: string;
      linkSelector?: string;
      maxPages?: number;
    };

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Please provide a URL." });
      return;
    }

    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid URL format." });
      return;
    }

    const pages = typeof maxPages === "number" ? Math.min(Math.max(1, maxPages), 50) : 20;

    const bookData = await scrapeMultiPage(url, linkSelector || undefined, pages);

    if (bookData.sections.length === 0) {
      res.status(422).json({ error: "No readable content found." });
      return;
    }

    res.json(bookData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log?.error({ err }, "Multi-page scrape failed");

    if (msg.includes("private") || msg.includes("Only http")) {
      res.status(400).json({ error: msg });
      return;
    }

    res.status(500).json({ error: `Failed to scrape: ${msg}` });
  }
});

export default scrapeRouter;

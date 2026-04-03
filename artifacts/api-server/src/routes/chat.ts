import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const chatRouter = Router();

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SYSTEM_CHARS = 2000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

chatRouter.post("/chat", async (req, res) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "unknown";

    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests — slow down." });
      return;
    }

    const origin = req.headers["origin"] || "";
    const allowedPattern = /\.replit\.dev$|\.repl\.co$|localhost/;
    if (origin && allowedPattern.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    const { messages, systemPrompt } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      systemPrompt?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const trimmedMessages = messages.slice(-MAX_MESSAGES).map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
    }));

    const safeSystem = String(systemPrompt ?? "You are a helpful STEM tutor.").slice(0, MAX_SYSTEM_CHARS);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: safeSystem,
      messages: trimmedMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log?.error({ err }, "chat error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Chat failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

export default chatRouter;

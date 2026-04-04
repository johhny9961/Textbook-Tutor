import { Router } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const chatRouter = Router();

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SYSTEM_CHARS = 2000;

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1, "At least one message is required")
    .transform((msgs) => msgs.slice(-MAX_MESSAGES)),
  systemPrompt: z.string().max(MAX_SYSTEM_CHARS).optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const MAX_MAP_SIZE = 10_000;
let lastEviction = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Evict expired entries every 60s to prevent unbounded memory growth
  if (now - lastEviction > RATE_WINDOW_MS || rateLimitMap.size > MAX_MAP_SIZE) {
    for (const [key, entry] of rateLimitMap) {
      if (now >= entry.resetAt) rateLimitMap.delete(key);
    }
    lastEviction = now;
  }

  const safeIp = ip.slice(0, 45);
  const entry = rateLimitMap.get(safeIp);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(safeIp, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

chatRouter.post("/chat", async (req, res) => {
  try {
    const ip = req.socket.remoteAddress || "unknown";

    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests — slow down." });
      return;
    }

    const origin = req.headers["origin"] || "";
    const allowedPattern = /\.replit\.dev$|\.repl\.co$|localhost/;
    if (origin && allowedPattern.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { messages: trimmedMessages, systemPrompt } = parsed.data;
    const safeSystem = systemPrompt ?? "You are a helpful STEM tutor.";

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

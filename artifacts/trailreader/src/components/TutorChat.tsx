import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, RotateCcw, Loader2, ChevronDown } from "lucide-react";
import type { ChatMessage, BookSection } from "@/types";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const TRAIL_GUIDE_PROMPT = `You are Trail Guide, an AI tutor for OAT (Optometry Admission Test) students. You specialize in helping neurodivergent learners (ADHD, autism) study effectively.

Your approach follows a 5-phase method:
1. **Anchor** - Connect new concept to something familiar the student already knows
2. **Pattern** - Point out the underlying rule or structure
3. **Example** - Show a concrete, specific example
4. **Apply** - Prompt the student to try or predict something
5. **Connect** - Link to related OAT topics or prior knowledge

Rules:
- Ask ONE question at a time — never stack questions
- Keep responses SHORT (3-5 sentences max unless explaining a complex concept)
- Be Socratic: guide with questions, don't just give answers
- Use encouraging but realistic language — no hollow praise
- If a student seems stuck, offer a hint, not the answer
- Flag concepts that appear on OAT chemistry/biology/physics
- Use simple language; avoid jargon unless explaining the jargon itself`;

interface TutorChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentSection: BookSection | null;
}

export function TutorChat({ isOpen, onClose, currentSection }: TutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hey! I'm Trail Guide. Ask me anything about what you're reading — a concept that's confusing, a term you don't recognize, or how something connects to the OAT. What's on your mind?",
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const buildSystemPrompt = useCallback(() => {
    if (!currentSection) return TRAIL_GUIDE_PROMPT;
    const context = currentSection.paragraphs.slice(0, 20).join("\n").slice(0, 2000);
    return `${TRAIL_GUIDE_PROMPT}

---
CURRENT READING CONTEXT:
Chapter: ${currentSection.chapterTitle}
Section: ${currentSection.title}

Content excerpt:
${context}
---

When relevant, refer to this specific section. Help the student understand this material in depth.`;
  }, [currentSection]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: buildSystemPrompt(),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (!data.trim()) continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.done) break;
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.content,
                  };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && last.content === "") {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, I couldn't connect right now. Check your connection and try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, isStreaming, buildSystemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([{
      role: "assistant",
      content: "Chat cleared! What would you like to explore?",
    }]);
    setIsStreaming(false);
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  return (
    <>
      <button
        className={`tutor-overlay ${isOpen ? "tutor-overlay-visible" : ""}`}
        onClick={onClose}
        aria-label="Close tutor overlay"
        tabIndex={isOpen ? 0 : -1}
        type="button"
      />
      <div
        className={`tutor-panel ${isOpen ? "tutor-panel-open" : ""}`}
        aria-hidden={!isOpen}
        {...(!isOpen ? { inert: true } : {})}
      >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Trail Guide tutor"
        aria-modal={true}
        tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        style={{ display: "flex", flexDirection: "column", height: "100%", outline: "none" }}
      >
        <div className="tutor-header">
          <div className="tutor-header-info">
            <div className="tutor-avatar">
              <Bot size={16} />
            </div>
            <div>
              <div className="tutor-name">Trail Guide</div>
              <div className="tutor-subtitle">
                {currentSection ? currentSection.title : "OAT Tutor"}
              </div>
            </div>
          </div>
          <div className="tutor-header-actions">
            <button className="icon-btn" onClick={clearChat} title="Clear chat" aria-label="Clear conversation">
              <RotateCcw size={15} />
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close tutor">
              <ChevronDown size={20} />
            </button>
          </div>
        </div>

        <div className="tutor-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`tutor-msg tutor-msg-${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="tutor-msg-avatar">
                  <Bot size={12} />
                </div>
              )}
              <div className="tutor-msg-bubble">
                {msg.content || (isStreaming && i === messages.length - 1 ? (
                  <span className="tutor-typing">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : "")}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="tutor-input-row">
          <textarea
            ref={inputRef}
            className="tutor-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Trail Guide anything…"
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="tutor-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            aria-label="Send message"
          >
            {isStreaming ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

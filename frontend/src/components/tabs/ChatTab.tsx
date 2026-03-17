"use client";

import { useState, useRef, useEffect } from "react";
import type { Message, Source } from "@/types";

const SUGGESTIONS = [
  "Which restaurants have the most critical violations?",
  "What are the top food safety issues in San Jose?",
  "Show food deserts in East San Jose",
  "Compare safety scores across cities",
  "Which zip codes need inspector attention?",
];

function genId() {
  return Math.random().toString(36).slice(2);
}

export default function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: genId(),
      role: "bot",
      content:
        "Hello! I'm your SafeEats AI assistant for Santa Clara County. I can answer questions about restaurant safety scores, food deserts, inspection trends, and more. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function sendMessage(question: string) {
    if (!question.trim() || typing) return;

    const userMsg: Message = {
      id: genId(),
      role: "user",
      content: question.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();

      const botMsg: Message = {
        id: genId(),
        role: "bot",
        content:
          data.answer ||
          data.response ||
          "I couldn't find an answer to that. Please try rephrasing.",
        sources: data.sources || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "bot",
          content:
            "Sorry, I encountered an error connecting to the AI service. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && !typing && (
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "20px",
                color: "var(--text-secondary)",
                fontSize: "11px",
                padding: "5px 10px",
                transition: "all 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-secondary)";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Ask about food safety in Santa Clara County..."
          style={{
            flex: 1,
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontSize: "13px",
            padding: "8px 10px",
            outline: "none",
          }}
          disabled={typing}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || typing}
          className="btn-accent"
          style={{
            minWidth: "60px",
            opacity: !input.trim() || typing ? 0.5 : 1,
            cursor: !input.trim() || typing ? "not-allowed" : "pointer",
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "6px",
          background: isUser
            ? "linear-gradient(135deg, var(--blue), var(--purple))"
            : "linear-gradient(135deg, var(--accent), #4a8000)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "85%" }}>
        <div
          style={{
            background: isUser ? "rgba(91,156,246,0.1)" : "var(--bg-card)",
            border: `1px solid ${isUser ? "rgba(91,156,246,0.2)" : "var(--border)"}`,
            borderRadius: isUser ? "8px 2px 8px 8px" : "2px 8px 8px 8px",
            padding: "8px 11px",
            fontSize: "13px",
            color: "var(--text-primary)",
            lineHeight: "1.55",
          }}
        >
          {message.content}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-jetbrains), monospace",
                marginRight: "2px",
              }}
            >
              Sources:
            </span>
            {message.sources.map((s: Source, i: number) => (
              <span
                key={i}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-jetbrains), monospace",
                }}
              >
                {s.name || s.excerpt || `Source ${i + 1}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "6px",
          background: "linear-gradient(135deg, var(--accent), #4a8000)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        AI
      </div>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "2px 8px 8px 8px",
          padding: "10px 14px",
          display: "flex",
          gap: "4px",
          alignItems: "center",
        }}
      >
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

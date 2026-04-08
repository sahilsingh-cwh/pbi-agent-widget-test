import * as React from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatThreadProps {
  endpoint: string;
  apiKey: string;
  locale: string;
}

export function ChatThread({ endpoint, apiKey }: ChatThreadProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // Stable session ID for multi-turn Agent Engine conversations
  const sessionIdRef = React.useRef<string>(
    "pbi-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 10)
  );

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      if (!text.trim() || !endpoint) return;

      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "X-API-Key": apiKey } : {}),
          },
          body: JSON.stringify({
            message: text,
            user_id: "pbi-user",
            session_id: sessionIdRef.current,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }

        const data = await res.json();
        const assistantMessage: Message = {
          role: "assistant",
          content: data.text || "No response",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [endpoint, apiKey]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {messages.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              color: "#999",
              marginTop: "40%",
              fontSize: "14px",
            }}
          >
            Ask the agent a question...
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              maxWidth: "80%",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#0078d4" : "#fff",
              color: msg.role === "user" ? "#fff" : "#333",
              borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              fontSize: "14px",
              lineHeight: "1.4",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div
            style={{
              maxWidth: "80%",
              alignSelf: "flex-start",
              background: "#fff",
              borderRadius: "12px 12px 12px 4px",
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              fontSize: "14px",
              color: "#999",
            }}
          >
            Thinking...
          </div>
        )}

        {error && (
          <div
            style={{
              maxWidth: "80%",
              alignSelf: "flex-start",
              background: "#fee",
              color: "#c00",
              borderRadius: "12px",
              padding: "10px 14px",
              fontSize: "13px",
            }}
          >
            Error: {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "12px",
          borderTop: "1px solid #e0e0e0",
          background: "#fff",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || !endpoint}
          placeholder={endpoint ? "Ask the agent..." : "No endpoint configured"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "20px",
            border: "1px solid #ddd",
            fontSize: "14px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim() || !endpoint}
          style={{
            padding: "10px 20px",
            borderRadius: "20px",
            border: "none",
            background: loading || !input.trim() ? "#ccc" : "#0078d4",
            color: "#fff",
            fontSize: "14px",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

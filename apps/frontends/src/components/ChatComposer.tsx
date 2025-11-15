"use client";
import { useState, KeyboardEvent } from "react";

export default function ChatComposer({
  onSend,
  disabled,
  placeholder = "Type your request… (Shift+Enter = newline)",
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");

  async function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    await onSend(t);
  }
  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={keyDown}
        placeholder={placeholder}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
            disabled || !text.trim()
              ? "bg-blue-400/50 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-600"
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
 
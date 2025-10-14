"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [health, setHealth] = useState<string>("checking…");
  const [prompt, setPrompt] = useState<string>("Say hello from Gemini.");
  const [answer, setAnswer] = useState<string>("");

  useEffect(() => {
    fetch("http://localhost:4000/api/health")
      .then(r => r.json())
      .then(j => setHealth(JSON.stringify(j, null, 2)))
      .catch(err => setHealth(String(err)));
  }, []);

  async function askLLM() {
    setAnswer("…thinking");
    const r = await fetch("http://localhost:4000/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const j = await r.json();
    setAnswer(j.ok ? j.text : `Error: ${j.error}`);
  }

  return (
    <main className="p-6 grid gap-6">
      <h1 className="text-3xl font-bold">Doable</h1>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Editor (read-only)</h2>
        <textarea
          readOnly
          value={`// read-only editor (LLM will apply changes)\n// tabs & Monaco next.`}
          className="w-full h-56 font-mono text-sm p-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))] outline-none"
        />
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Terminal</h2>
        <pre className="m-0 p-3 rounded-2xl border border-[rgb(var(--border))] bg-[#0e1111] text-[#eaeaea] min-h-36 overflow-auto">
{health}
        </pre>
      </section>
      
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Ask Gemini</h2>
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Type a prompt…"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200"
          />
          <button
            onClick={askLLM}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            Ask
          </button>
        </div>
        <pre className="m-0 p-3 rounded-2xl border border-gray-200 bg-white min-h-24 overflow-auto">
{answer}
        </pre>
      </section>
    </main>
  );
}

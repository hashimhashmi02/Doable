"use client";
import { useEffect, useState } from "react";
import CodeEditor from "@/components/CodeEditor";

type Tab = "editor" | "preview" | "terminal";

export default function Home() {
  const [health, setHealth] = useState<string>("checking…");
  const [prompt, setPrompt] = useState<string>("Say hello from Gemini.");
  const [answer, setAnswer] = useState<string>("");
  const [tab, setTab] = useState<Tab>("editor");

  // terminal
  const [cmd, setCmd] = useState<string>("node -v");
  const [cmdOut, setCmdOut] = useState<string>("");

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
    setAnswer(j.ok ? `(${j.modelUsed})\n\n${j.text}` : `Error: ${j.error}\n${j.detail ?? ""}`);
  }

  async function runCmd() {
    setCmdOut("…running");
    const r = await fetch("http://localhost:4000/api/tools/shell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd }),
    });
    const j = await r.json();
    setCmdOut(j.error ? `Error: ${j.error}` : `code: ${j.code}\n\n${j.out}${j.err ? "\n" + j.err : ""}`);
  }

  return (
    <main className="p-6 grid gap-6">
      <h1 className="text-3xl font-bold">Doable</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["editor","preview","terminal"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-xl border text-sm capitalize transition ${
              tab===t ? "bg-gray-900 text-white" : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "editor" && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Editor (read-only)</h2>
          <CodeEditor value={`// Doable: LLM edits only\n// TODO: wire files + patches via agent tools`} />
        </section>
      )}

      {tab === "preview" && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          <div className="rounded-2xl border border-gray-200 p-6">
            Coming soon: live iframe preview of sandbox app
          </div>
        </section>
      )}

      {tab === "terminal" && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Terminal</h2>
          <pre className="m-0 p-3 rounded-2xl border border-gray-200 bg-[#0e1111] text-[#eaeaea] min-h-24 overflow-auto">
{health}
          </pre>

          <div className="flex gap-2">
            <input
              value={cmd}
              onChange={e => setCmd(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 font-mono text-sm"
              placeholder='e.g. "node -v"'
            />
            <button onClick={runCmd} className="px-4 py-2 rounded-xl bg-gray-900 text-white">Run</button>
          </div>

          <pre className="m-0 p-3 rounded-2xl border border-gray-200 bg-black text-gray-100 min-h-36 overflow-auto">
{cmdOut}
          </pre>
        </section>
      )}

      {/* Ask Gemini */}
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Ask Gemini</h2>
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Type a prompt…"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200"
          />
          <button onClick={askLLM} className="px-4 py-2 rounded-xl bg-gray-900 text-white">Ask</button>
        </div>
        <pre className="m-0 p-3 rounded-2xl border border-gray-200 bg-white min-h-24 overflow-auto">
{answer}
        </pre>
      </section>
    </main>
  );
}

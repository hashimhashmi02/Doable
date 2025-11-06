"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import FilesSidebar from "@/components/FilesSidebar";
import CodeEditor from "@/components/CodeEditor";

type Tab = "editor" | "preview" | "terminal";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const SSE_PATH = process.env.NEXT_PUBLIC_SSE_PATH ?? "/api/llm/chat/stream";

export default function Home() {

  const [health, setHealth] = useState("checking…");


  const [tab, setTab] = useState<Tab>("editor");

 
  const [cmd, setCmd] = useState("node -v");
  const [cmdOut, setCmdOut] = useState("");
  const termOutRef = useRef<HTMLPreElement | null>(null);
  const [termStreaming, setTermStreaming] = useState(false);

  const [openFile, setOpenFile] = useState("");
  const [fileContent, setFileContent] = useState("");

  const [previewSrc, setPreviewSrc] = useState<string>(`${API}/preview`);
  const refreshPreview = () => setPreviewSrc(`${API}/preview?v=${Date.now()}`);
  const seedIndexHtml = async () => {
    await fetch(`${API}/api/sandbox/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "index.html",
        content: [
          "<!doctype html>",
          "<html>",
          "<head>",
          '  <meta charset="utf-8"/>',
          '  <meta name="viewport" content="width=device-width, initial-scale=1"/>',
          "  <title>Sandbox</title>",
          "  <style>",
          "    html,body{margin:0;font-family:ui-sans-serif,system-ui;background:#0a0f1a;}",
          "    .center{min-height:100dvh;display:grid;place-items:center;}",
          "    .card{background:#fff;color:#111;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:560px}",
          "    .btn{border:none;background:#2563eb;color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer}",
          "  </style>",
          "</head>",
          "<body>",
          '  <main class="center">',
          '    <section class="card">',
          "      <h1 style='margin:0 0 8px 0'>Hello from Sandbox 👋</h1>",
          "      <p style='margin:0 0 16px 0'>Edit <code>index.html</code> and press <b>Refresh</b> in the Preview tab.</p>",
          '      <button class="btn" onclick="document.body.style.background=`hsl(${Math.random()*360},70%,8%)`">Change BG</button>',
          "    </section>",
          "  </main>",
          "</body>",
          "</html>",
        ].join("\n"),
      }),
    });
    refreshPreview();
  };

  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const ansRef = useRef<HTMLPreElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((j) => setHealth(JSON.stringify(j, null, 2)))
      .catch((err) => setHealth(String(err)));
  }, []);

  function runCmdStream() {
    if (!cmd.trim()) return;
    setTermStreaming(true);
    setCmdOut("");

    const es = new EventSource(`${API}/api/tools/shell/stream?cmd=${encodeURIComponent(cmd)}`);

    const onChunk = (s: string) => {
      setCmdOut((prev) => (prev ? prev + s : s));
      termOutRef.current?.scrollTo({ top: termOutRef.current.scrollHeight, behavior: "smooth" });
    };

    es.addEventListener("stdout", (e) => onChunk((e as MessageEvent).data.replaceAll("\\n", "\n")));
    es.addEventListener("stderr", (e) => onChunk((e as MessageEvent).data.replaceAll("\\n", "\n")));
    es.addEventListener("done", (e) => {
      onChunk(`\n\nexit code: ${(e as MessageEvent).data}`);
      es.close();
      setTermStreaming(false);
    });
    es.onerror = () => {
      onChunk("\n\n[stream error]");
      es.close();
      setTermStreaming(false);
    };
  }

  async function openSandboxFile(file: string) {
    setOpenFile(file);
    setFileContent("…loading");
    const r = await fetch(`${API}/api/sandbox/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    });
    const j = await r.json();
    setFileContent(j.content ?? "");
  }

  function askLLMStream() {
    if (!prompt.trim() || asking) return;
    setAsking(true);
    setAnswer("");

    const url =
      `${API}${SSE_PATH.startsWith("/") ? "" : "/"}${SSE_PATH}` +
      `?${new URLSearchParams({ prompt, temperature: "0.6", maxOutputTokens: "2048" }).toString()}`;

    const es = new EventSource(url);

    es.addEventListener("token", (e) => {
      setAnswer((prev) => prev + (e as MessageEvent).data.replaceAll("\\n", "\n"));
      ansRef.current?.scrollTo({ top: ansRef.current.scrollHeight });
    });

    es.addEventListener("server-error", (e) => {
      const msg = (e as MessageEvent).data || "unknown error";
      setAnswer((prev) => prev + `\n\n[server error] ${msg}`);
    });

    es.addEventListener("done", () => {
      es.close();
      setAsking(false);
    });

    es.onerror = () => {
      setAnswer((prev) => prev + "\n\n[stream error]");
      es.close();
      setAsking(false);
    };

    setPrompt("");
    inputRef.current?.focus();
  }

  function onPromptKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askLLMStream();
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0F1A] to-black text-white">

      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-[1200px] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 grid place-items-center">⌘</div>
            <span className="text-2xl font-semibold">Doable</span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button className="px-3 py-1.5 text-sm hover:opacity-80">Sign in</button>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-sm font-semibold hover:bg-blue-700">Get started</button>
          </div>
        </div>
      </header>
      <section className="relative mx-auto max-w-[1200px] px-6 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/20 bg-white/10">
          <span className="text-sm">Create anything with AI</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-5">
          What will you <span className="text-blue-500">build</span> today?
        </h1>
        <p className="text-lg text-white/70 mb-8">Create stunning apps & websites by chatting with AI.</p>

        <div className="max-w-3xl mx-auto bg-white/5 rounded-2xl border border-white/20 p-5">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onPromptKey}
            rows={3}
            placeholder="Let's build a dashboard to track KPI…"
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-3 text-white placeholder:text-white/50 focus:outline-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={askLLMStream}
              disabled={asking || !prompt.trim()}
              className={`px-5 py-2 rounded-lg text-sm font-semibold ${
                asking || !prompt.trim() ? "bg-blue-400/50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {asking ? "Building…" : "Build now"}
            </button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1200px] px-6 pb-16 grid gap-6">
        <h2 className="text-xl font-semibold">Workbench</h2>
        <div className="flex gap-2">
          {(["editor", "preview", "terminal"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg border text-sm capitalize ${
                tab === t ? "bg-white text-black border-white" : "bg-transparent text-white border-white/40 hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[18rem,1fr] gap-4">
          <aside className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold">Files</h3>
              <button
                onClick={() => openFile && openSandboxFile(openFile)}
                className="px-2 py-1 rounded-md text-xs border border-white/20"
              >
                Refresh
              </button>
            </div>
            <FilesSidebar selected={openFile} onOpen={openSandboxFile} />
          </aside>
          <section className="grid gap-4">
            {tab === "editor" && (
              <div className="rounded-xl border border-white/20 bg-white/10">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
                  <h3 className="text-base font-semibold">{openFile ? `Editor — ${openFile}` : "Editor — (open a file)"}</h3>
                  <button
                    className="px-3 py-1.5 rounded-md bg-white text-black text-sm font-semibold"
                    onClick={async () => {
                      await fetch(`${API}/api/sandbox/write`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          file: "readme.md",
                          content: `# Doable Sandbox\n\nCreated at ${new Date().toISOString()}\n`,
                        }),
                      });
                      setOpenFile("");
                      setFileContent("");
                    }}
                  >
                    + Seed file
                  </button>
                </div>
                <div className="p-3">
                  <CodeEditor value={fileContent || "// open a file from the sidebar"} />
                </div>
              </div>
            )}

      
            {tab === "preview" && (
              <div className="rounded-xl border border-white/20 bg-white/10">
                <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Preview</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={seedIndexHtml} className="px-3 py-1.5 rounded-md text-sm border border-white/20">
                      Seed index.html
                    </button>
                    <button onClick={refreshPreview} className="px-3 py-1.5 rounded-md text-sm bg-white text-black font-semibold">
                      Refresh
                    </button>
                  </div>
                </div>
                <iframe
                  key={previewSrc}
                  src={previewSrc}
                  className="w-full h-[560px] rounded-b-xl bg-white"
                  sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin"
                />
              </div>
            )}
            {tab === "terminal" && (
              <div className="rounded-xl border border-white/20 bg-white/10 grid gap-3">
                <div className="px-4 py-3 border-b border-white/20">
                  <h3 className="text-base font-semibold">Terminal</h3>
                </div>
                <pre className="m-0 p-3 rounded-md border border-white/20 bg-black text-white min-h-24 overflow-auto">
{health}
                </pre>
                <div className="flex gap-2 px-3 pb-3">
                  <input
                    value={cmd}
                    onChange={(e) => setCmd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !termStreaming) runCmdStream();
                    }}
                    className="flex-1 px-3 py-2 rounded-md border border-white/20 bg-black text-white font-mono text-sm placeholder:text-white/50"
                    placeholder='e.g. "node -v"'
                  />
                  <button
                    onClick={runCmdStream}
                    disabled={termStreaming}
                    className={`px-4 py-2 rounded-md font-semibold ${
                      termStreaming ? "bg-white/40 text-black cursor-not-allowed" : "bg-white text-black"
                    }`}
                  >
                    {termStreaming ? "Running…" : "Run"}
                  </button>
                </div>
                <pre
                  ref={termOutRef}
                  className="m-0 p-3 rounded-md border border-white/20 bg-black text-white min-h-36 max-h-[420px] overflow-auto"
                >
{cmdOut}
                </pre>
              </div>
            )}

            <div className="rounded-xl border border-white/20 bg-white/10">
              <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
                <h3 className="text-base font-semibold">Response</h3>
              </div>
              <pre
                ref={ansRef}
                className="m-0 p-3 rounded-md border border-white/20 bg-black text-white min-h-32 max-h-[420px] overflow-auto whitespace-pre-wrap"
              >
{answer}
              </pre>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

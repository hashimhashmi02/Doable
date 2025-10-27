"use client";
import { useEffect, useRef, useState, MouseEvent } from "react";
import FilesSidebar from "@/components/FilesSidebar";
import CodeEditor from "@/components/CodeEditor";

type Tab = "editor" | "preview" | "terminal";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  const [health, setHealth] = useState<string>("checking…");
  const [tab, setTab] = useState<Tab>("editor");

  // terminal
  const [cmd, setCmd] = useState<string>("node -v");
  const [cmdOut, setCmdOut] = useState<string>("");
  const outRef = useRef<HTMLPreElement | null>(null);
  const [streaming, setStreaming] = useState(false);

  // editor / sandbox
  const [openFile, setOpenFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");

  // gemini
  const [prompt, setPrompt] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ansRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((j) => setHealth(JSON.stringify(j, null, 2)))
      .catch((err) => setHealth(String(err)));
  }, []);

  // --- terminal (SSE)
  async function runCmdStream() {
    if (!cmd.trim()) return;
    setStreaming(true);
    setCmdOut("");
    const es = new EventSource(`${API}/api/tools/shell/stream?cmd=${encodeURIComponent(cmd)}`);

    es.addEventListener("stdout", (e) => {
      setCmdOut((prev) => (prev ? prev + e.data.replaceAll("\\n", "\n") : e.data.replaceAll("\\n", "\n")));
      outRef.current?.scrollTo({ top: outRef.current.scrollHeight, behavior: "smooth" });
    });
    es.addEventListener("stderr", (e) => {
      setCmdOut((prev) => (prev ? prev + e.data.replaceAll("\\n", "\n") : e.data.replaceAll("\\n", "\n")));
      outRef.current?.scrollTo({ top: outRef.current.scrollHeight, behavior: "smooth" });
    });
    es.addEventListener("done", (e) => {
      setCmdOut((prev) => `${prev}\n\nexit code: ${e.data}`);
      es.close();
      setStreaming(false);
    });
    es.onerror = () => {
      setCmdOut((prev) => prev + "\n\n[stream error]");
      es.close();
      setStreaming(false);
    };
  }
  function runCmd(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    void runCmdStream();
  }

  // --- sandbox
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

  // --- gemini (SSE + auto-continue)
  async function askLLMStream() {
    if (!prompt.trim() || asking) return;
    setAsking(true);
    setAnswer("");
    const url =
      `${API}/api/llm/chat/stream?` +
      new URLSearchParams({ prompt, temperature: "0.6", maxOutputTokens: "2048" }).toString();

    const es = new EventSource(url);
    es.addEventListener("token", (e) => {
      setAnswer((prev) => prev + e.data.replaceAll("\\n", "\n"));
      ansRef.current?.scrollTo({ top: ansRef.current.scrollHeight });
    });
    es.addEventListener("done", () => {
      es.close();
      setAsking(false);
    });
    es.addEventListener("error", () => {
      setAnswer((prev) => prev + "\n\n[stream error]");
      es.close();
      setAsking(false);
    });

    setPrompt(""); // clear immediately
    inputRef.current?.focus();
  }

  return (
    <main className="p-6 grid gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Doable</h1>
        <div className="text-xs text-gray-500">sandboxed editor · gemini tools</div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["editor", "preview", "terminal"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-xl border text-sm capitalize transition ${
              tab === t ? "bg-gray-900 text-white" : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Editor */}
      {tab === "editor" && (
        <section className="grid gap-3">
          <div className="grid grid-cols-[16rem,1fr] gap-4">
            <FilesSidebar selected={openFile} onOpen={openSandboxFile} />
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {openFile ? `Editor — ${openFile}` : "Editor — (open a file)"}
                </h2>
                <button
                  className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
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
              <div className="rounded-2xl border border-gray-200 bg-white p-3">
                <CodeEditor value={fileContent || "// open a file from the sidebar"} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Preview */}
      {tab === "preview" && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            Coming soon: live iframe preview of sandbox app
          </div>
        </section>
      )}

      {/* Terminal */}
      {tab === "terminal" && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Terminal</h2>
          <pre className="m-0 p-3 rounded-2xl border border-gray-200 bg-[#0e1111] text-[#eaeaea] min-h-24 overflow-auto">
{health}
          </pre>

          <div className="flex gap-2">
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !streaming) runCmdStream();
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 font-mono text-sm"
              placeholder='e.g. "node -v"'
            />
            <button
              onClick={runCmd}
              disabled={streaming}
              className={`px-4 py-2 rounded-xl text-white ${
                streaming ? "bg-gray-400" : "bg-gray-900 hover:opacity-90"
              }`}
            >
              {streaming ? "Running…" : "Run"}
            </button>
          </div>

          <pre
            ref={outRef}
            className="m-0 p-3 rounded-2xl border border-gray-200 bg-black text-gray-100 min-h-36 max-h-[420px] overflow-auto"
          >
{cmdOut}
          </pre>
        </section>
      )}

      {/* Ask Gemini (streaming) */}
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Ask Gemini</h2>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 grid gap-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") askLLMStream();
              }}
              placeholder=""
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200"
              autoFocus
            />
            <button
              onClick={askLLMStream}
              disabled={asking}
              className={`px-4 py-2 rounded-xl text-white ${
                asking ? "bg-gray-400" : "bg-gray-900 hover:opacity-90"
              }`}
            >
              {asking ? "Thinking…" : "Ask"}
            </button>
          </div>

          <pre
            ref={ansRef}
            className="m-0 p-3 rounded-xl border border-gray-100 bg-gray-50 min-h-24 max-h-[420px] overflow-auto"
          >
{answer}
          </pre>
        </div>
      </section>
    </main>
  );
}

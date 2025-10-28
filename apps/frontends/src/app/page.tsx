"use client";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import FilesSidebar from "@/components/FilesSidebar";
import CodeEditor from "@/components/CodeEditor";

type Tab = "editor" | "preview" | "terminal";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {

  const [health, setHealth] = useState("checking…");

 
  const [tab, setTab] = useState<Tab>("editor");


  const [cmd, setCmd] = useState("node -v");
  const [cmdOut, setCmdOut] = useState("");
  const termOutRef = useRef<HTMLPreElement | null>(null);
  const [termStreaming, setTermStreaming] = useState(false);

  const [openFile, setOpenFile] = useState("");
  const [fileContent, setFileContent] = useState("");


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


  async function runCmdStream() {
    if (!cmd.trim()) return;
    setTermStreaming(true);
    setCmdOut("");
    const es = new EventSource(`${API}/api/tools/shell/stream?cmd=${encodeURIComponent(cmd)}`);

    const onChunk = (s: string) => {
      setCmdOut((prev) => (prev ? prev + s : s));
      termOutRef.current?.scrollTo({ top: termOutRef.current.scrollHeight, behavior: "smooth" });
    };

    es.addEventListener("stdout", (e) => onChunk(e.data.replaceAll("\\n", "\n")));
    es.addEventListener("stderr", (e) => onChunk(e.data.replaceAll("\\n", "\n")));
    es.addEventListener("done", (e) => {
      onChunk(`\n\nexit code: ${e.data}`);
      es.close();
      setTermStreaming(false);
    });
    es.onerror = () => {
      onChunk("\n\n[stream error]");
      es.close();
      setTermStreaming(false);
    };
  }
  async function runCmd() {
    void runCmdStream();
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

    setPrompt("");
    inputRef.current?.focus();
  }

  function onPromptKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void askLLMStream();
    }
  }

  function onBuildClick() {
    void askLLMStream();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0F1A] to-black text-white overflow-hidden">

      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/50 backdrop-blur">
        <div className="mx-auto max-w-[1800px] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">❯❯❯❯</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">Doable</span>
          </div>

     
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <a href="#" className="hover:text-white transition">Community</a>
            <a href="#" className="hover:text-white transition">Enterprise</a>
            <a href="#" className="hover:text-white transition flex items-center gap-1">
              Resources
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
            <a href="#" className="hover:text-white transition">Careers</a>
            <a href="#" className="hover:text-white transition">Pricing</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3">
              <a href="#" className="hover:opacity-70 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2512-.1953.3718-.3024a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1206.107.246.2081.3728.3024a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9491-1.5219 6.0029-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-.9965-2.1569-2.2272 0-1.2296.9555-2.2272 2.157-2.2272 1.2108 0 2.1757.9976 2.1568 2.2272 0 1.2307-.9555 2.2272-2.1569 2.2272zm7.9748 0c-1.1825 0-2.1569-.9965-2.1569-2.2272 0-1.2296.9554-2.2272 2.1569-2.2272 1.2108 0 2.1757.9976 2.1568 2.2272 0 1.2307-.9555 2.2272-2.1568 2.2272z" />
                </svg>
              </a>
              <a href="#" className="hover:opacity-70 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#" className="hover:opacity-70 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="hover:opacity-70 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.222.083.343-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.487.535 6.624 0 11.99-5.367 11.99-11.987C23.97 5.39 18.592.026 11.985.017L12.017 0z" />
                </svg>
              </a>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <button className="px-4 py-2 text-sm font-medium hover:opacity-80 transition">Sign in</button>
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold hover:bg-blue-700 transition">Get started</button>
          </div>
        </div>
      </header>

   
      <div className="relative min-h-[calc(100vh-4rem)]">

        <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden" style={{ height: '400px' }}>
          <svg className="absolute bottom-0" width="100%" height="400px" viewBox="0 0 1920 400" preserveAspectRatio="none">
            <path d="M0,250 Q480,100 960,150 T1920,200" stroke="#3B82F6" strokeWidth="2" fill="none" opacity="0.8" className="blur-sm" />
            <path d="M0,260 Q480,110 960,160 T1920,210" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" opacity="0.6" className="blur-sm" />
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-16 text-center">
 
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/20 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10h5l-1.5 2-1.5-2z" />
            </svg>
            <span className="text-sm font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Create anything with AI</span>
          </div>

      
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            What will you <span className="text-blue-500">build</span> today?
          </h1>

         
          <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
            Create stunning apps & websites by chatting with AI.
          </p>

    
          <div className="relative max-w-4xl mx-auto mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-2xl">
              
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onPromptKey}
                rows={3}
                placeholder="Let's build a dashboard to track KPI"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />

              <div className="flex items-center justify-between mt-4">
             
                <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:bg-white/10 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-sm">Plan</span>
                  </button>
                  <button
                    onClick={onBuildClick}
                    disabled={asking || !prompt.trim()}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition ${
                      asking || !prompt.trim()
                        ? "bg-blue-400/50 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    Build now
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6">
            <span className="text-sm text-white/60">or import from</span>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.84 10.5a2.5 2.5 0 01-2.42 2.42c-1.39 0-2.5-1.11-2.5-2.5s1.11-2.5 2.5-2.5c1.39 0 2.5 1.11 2.42 2.5zm2.49-1.5c0-2.75-2.25-5-5-5S8.84 6.25 8.84 9h2.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5h2.5z" />
                </svg>
                <span className="text-sm font-medium">Figma</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="text-sm font-medium">GitHub</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {answer && (
        <section className="mx-auto max-w-7xl px-6 py-10 grid gap-6">
          <h2 className="text-xl font-bold">Workbench</h2>

      
          <div className="flex gap-2">
            {(["editor", "preview", "terminal"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-xl border text-sm capitalize transition font-medium ${
                  tab === t
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-white border-white/40 hover:bg-white/10"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-[18rem,1fr] gap-4">
        
            <aside className="rounded-2xl border border-white/20 bg-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Files</h3>
                <button
                  onClick={() => openFile && openSandboxFile(openFile)}
                  className="px-2 py-1 rounded-lg text-xs border border-white/20"
                >
                  Refresh
                </button>
              </div>
              <FilesSidebar selected={openFile} onOpen={openSandboxFile} />
            </aside>  
            <section className="grid gap-4">
              {tab === "editor" && (
                <div className="rounded-2xl border border-white/20 bg-white/10">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
                    <h3 className="text-base font-semibold">
                      {openFile ? `Editor — ${openFile}` : "Editor — (open a file)"}
                    </h3>
                    <button
                      className="px-3 py-1.5 rounded-xl bg-white text-black text-sm font-semibold"
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
                <div className="rounded-2xl border border-white/20 bg-white/10">
                  <div className="px-4 py-3 border-b border-white/20">
                    <h3 className="text-base font-semibold">Preview</h3>
                  </div>
                  <div className="p-6">Coming soon: live iframe preview of sandbox app</div>
                </div>
              )}

              {tab === "terminal" && (
                <div className="rounded-2xl border border-white/20 bg-white/10 grid gap-3">
                  <div className="px-4 py-3 border-b border-white/20">
                    <h3 className="text-base font-semibold">Terminal</h3>
                  </div>
                  <pre className="m-0 p-3 rounded-xl border border-white/20 bg-black text-white min-h-24 overflow-auto">
{health}
                  </pre>
                  <div className="flex gap-2 px-3 pb-3">
                    <input
                      value={cmd}
                      onChange={(e) => setCmd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !termStreaming) runCmdStream();
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-white/20 bg-black text-white font-mono text-sm placeholder:text-white/50"
                      placeholder='e.g. "node -v"'
                    />
                    <button
                      onClick={runCmd}
                      disabled={termStreaming}
                      className={`px-4 py-2 rounded-xl font-semibold ${
                        termStreaming ? "bg-white/40 text-black cursor-not-allowed" : "bg-white text-black"
                      }`}
                    >
                      {termStreaming ? "Running…" : "Run"}
                    </button>
                  </div>
                  <pre
                    ref={termOutRef}
                    className="m-0 p-3 rounded-xl border border-white/20 bg-black text-white min-h-36 max-h-[420px] overflow-auto"
                  >
{cmdOut}
                  </pre>
                </div>
              )}

             
              <div className="rounded-2xl border border-white/20 bg-white/10">
                <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Response</h3>
                </div>
                <div className="p-3">
                  <pre
                    ref={ansRef}
                    className="m-0 p-3 rounded-xl border border-white/20 bg-black text-white min-h-32 max-h-[420px] overflow-auto whitespace-pre-wrap"
                  >
{answer}
                  </pre>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
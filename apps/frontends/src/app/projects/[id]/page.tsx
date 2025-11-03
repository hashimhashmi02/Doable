"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { API, authHeaders, j } from "@/lib/api";
import FilesSidebar from "@/components/FilesSidebar";

type MessageFrom = "USER" | "ASSISTANT";
type ConversationType = "TEXT_MESSAGE" | "TOOL_CALL";

type Msg = {
  id: string;
  from: MessageFrom;
  type: ConversationType;
  contents: string;
  createdAt: string;
};

type Project = {
  id: string;
  title: string;
  initialPrompt: string;
  createdAt: string;
};

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = useMemo(() => String(id), [id]);

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<HTMLDivElement | null>(null);

  // Load project + last 50 messages
  useEffect(() => {
    async function load() {
      const r = await fetch(`${API}/api/project/${projectId}`, {
        headers: authHeaders()
      });
      const data = await j<{ ok: boolean; project: Project; messages: Msg[] }>(r);
      setProject(data.project);
      setMessages(data.messages ?? []);
    }
    if (projectId) void load();
  }, [projectId]);

  // Auto-scroll on new message
  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
  }, [messages]);

  // Stream chat w/ SSE
  async function sendAndStream() {
    if (!prompt.trim() || streaming) return;
    const userMsg: Msg = {
      id: `tmp-${Date.now()}`,
      from: "USER",
      type: "TEXT_MESSAGE",
      contents: prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    const url = new URL(`${API}/api/project/conversation/${projectId}/stream`);
    url.searchParams.set("prompt", prompt);

    setPrompt("");
    setStreaming(true);
    const es = new EventSource(url.toString(), { withCredentials: true });

    let assistantBuffer = "";
    // Push a placeholder assistant message that we mutate
    const tempAssistantId = `asst-${Date.now()}`;
    setMessages((m) => [
      ...m,
      {
        id: tempAssistantId,
        from: "ASSISTANT",
        type: "TEXT_MESSAGE",
        contents: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    function patchAssistant(chunk: string) {
      assistantBuffer += chunk.replaceAll("\\n", "\n");
      setMessages((m) =>
        m.map((x) =>
          x.id === tempAssistantId ? { ...x, contents: assistantBuffer } : x
        )
      );
      streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
    }

    es.addEventListener("token", (e) => patchAssistant(e.data));
    es.addEventListener("meta", () => {}); // ignored for now
    es.addEventListener("done", () => {
      es.close();
      setStreaming(false);
    });
    es.addEventListener("error", () => {
      patchAssistant("\n\n[stream error]");
      es.close();
      setStreaming(false);
    });
  }

  if (!project) {
    return (
      <main className="min-h-screen text-white bg-black grid place-items-center">
        <div className="opacity-70">Loading project…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0F1A] to-black text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">
            {project.title}
            <span className="ml-3 text-xs text-white/50">#{project.id.slice(0, 6)}</span>
          </h1>
          <a
            href="/projects"
            className="text-sm text-white/70 hover:text-white transition"
          > ← All projects
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6 grid lg:grid-cols-[18rem,1fr] gap-4">
        <aside className="rounded-2xl border border-white/20 bg-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold">Files</h3>
            <button
              onClick={() => {}}
              className="px-2 py-1 rounded-lg text-xs border border-white/20"
            >
              Refresh
            </button>
          </div>
          <FilesSidebar selected={""} onOpen={() => {}} />
        </aside>
        <div className="grid gap-4">
          <div
            ref={streamRef}
            className="rounded-2xl border border-white/20 bg-white/5 min-h-[420px] max-h-[62vh] overflow-auto p-4"
          >
            {messages.length === 0 && (
              <div className="text-white/50 text-sm">
                No messages yet. Start by sending the initial prompt.
              </div>
            )}
            <ul className="grid gap-3">
              {messages.map((m) => (
                <li key={m.id} className="grid gap-1">
                  <div className="text-xs uppercase tracking-wide text-white/40">
                    {m.from === "USER" ? "You" : "Doable (Gemini)"}
                    <span className="ml-2 text-[10px]">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-black/40 border border-white/10 rounded-xl p-3">
                    {m.contents}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendAndStream();
                }
              }}
              placeholder="Ask the assistant to make a change…  (Shift+Enter = newline)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-white/40">
                Model: <span className="text-white/70">Gemini</span> · Streaming SSE
              </div>
              <button
                onClick={sendAndStream}
                disabled={streaming || !prompt.trim()}
                className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
                  streaming || !prompt.trim()
                    ? "bg-blue-400/50 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {streaming ? "Streaming…" : "Send & Stream"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

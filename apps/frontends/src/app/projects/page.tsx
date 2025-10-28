"use client";
import { useEffect, useState } from "react";
import { API, authHeaders, j } from "@/lib/api";

type Project = { id: string; title: string; createdAt: string; updatedAt: string };

export default function ProjectsPage() {
  const [list, setList] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [initialPrompt, setInitialPrompt] = useState("");

  async function load() {
    const r = await fetch(`${API}/api/projects`, { headers: { ...authHeaders() } });
    const data = await j<{ ok: boolean; projects: Project[] }>(r);
    setList(data.projects);
  }

  useEffect(() => { load(); }, []);

  async function createProject() {
    if (!title.trim() || !initialPrompt.trim()) return;
    await fetch(`${API}/api/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title, initialPrompt }),
    }).then(j);
    setTitle(""); setInitialPrompt("");
    await load();
  }

  return (
    <main className="max-w-4xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Projects</h1>

      <div className="grid gap-2 rounded-xl border border-white/20 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          className="px-3 py-2 rounded-lg bg-black/40 border border-white/20"
        />
        <textarea
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          placeholder="Initial prompt"
          rows={3}
          className="px-3 py-2 rounded-lg bg-black/40 border border-white/20"
        />
        <button onClick={createProject} className="px-4 py-2 rounded-lg bg-blue-600 font-semibold">Create</button>
      </div>

      <ul className="grid gap-3">
        {list.map(p => (
          <li key={p.id} className="rounded-lg border border-white/20 p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.title}</div>
              <div className="text-xs text-white/60">Updated {new Date(p.updatedAt).toLocaleString()}</div>
            </div>
            <a href={`/project/${p.id}`} className="px-3 py-1.5 rounded bg-white text-black text-sm">Open</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

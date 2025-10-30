"use client";
import { useEffect, useState } from "react";

type Props = {
  selected?: string;
  onOpen: (file: string) => void;
};

export default function FilesSidebar({ selected, onOpen }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("http://localhost:4000/api/sandbox/list");
      const j = await r.json();
      setFiles(j.files ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <aside className="w-64 border border-white/20 rounded-xl p-3 grid gap-2 bg-white/10">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Files</h3>
        <button
          onClick={refresh}
          className="text-xs px-2 py-1 rounded-lg border border-white/20 hover:bg-white/10 text-white/70"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <ul className="text-sm grid gap-1">
        {files.length === 0 && <li className="text-white/50">No files here</li>}
        {files.map(f => (
          <li key={f}>
            <button
              onClick={() => onOpen(f)}
              className={`w-full text-left px-2 py-1 rounded-lg hover:bg-white/10 transition ${
                selected === f ? "bg-blue-600 text-white hover:bg-blue-700" : "text-white/80"
              }`}
              title={f}
            >
              {f}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

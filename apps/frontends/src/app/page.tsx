"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [health, setHealth] = useState<string>("checking…");

  useEffect(() => {
    fetch("http://localhost:4000/api/health")
      .then(r => r.json())
      .then(j => setHealth(JSON.stringify(j, null, 2)))
      .catch(err => setHealth(String(err)));
  }, []);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Doable-v0</h1>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>Editor (read-only)</h2>
        <textarea
          readOnly
          value={`// read-only editor (LLM will apply changes)\n// next: mount Monaco, add tabs for code/preview/terminal.`}
          style={{
            width: "100%",
            height: 220,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
            fontSize: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e3e3e3",
            background: "#0e1111"
          }}
        />
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>Terminal</h2>
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e3e3e3",
            background: "#0e1111",
            color: "#f3f3f3ff",
            minHeight: 140,
            overflow: "auto"
          }}
        >
{health}
        </pre>
      </section>
    </main>
  );
}

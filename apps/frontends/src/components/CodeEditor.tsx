"use client";

import { useEffect, useRef } from "react";
type MonacoNS = typeof import("monaco-editor/esm/vs/editor/editor.api");
type StandaloneCodeEditor =
  import("monaco-editor/esm/vs/editor/editor.api").editor.IStandaloneCodeEditor;

export default function CodeEditor({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<StandaloneCodeEditor | null>(null);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const monaco: MonacoNS = await import(
        "monaco-editor/esm/vs/editor/editor.api"
      );
      (self as any).MonacoEnvironment = {
        getWorker(_: unknown, label: string) {
          if (label === "json") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/json/json.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          if (label === "css" || label === "scss" || label === "less") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/css/css.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          if (label === "html" || label === "handlebars" || label === "razor") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/html/html.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          if (label === "typescript" || label === "javascript") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/typescript/ts.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/editor/editor.worker.js",
              import.meta.url
            ),
            { type: "module" }
          );
        },
      };

      if (disposed || !containerRef.current) return;
      const origError = console.error;
      console.error = (...args) => {
        if (String(args[0] ?? "").includes("Canceled")) return;
        origError(...(args as any));
      };
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: value || "// open a file from the sidebar",
        language: "typescript",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
      });
    })();

    return () => {
      disposed = true;
      try {
        editorRef.current?.dispose();
      } catch {}
    };
  }, [value]);
  return (
    <div
      ref={containerRef}
      className="w-full h-[520px] rounded-b-2xl bg-[#0b0f19]"
    />
  );
}

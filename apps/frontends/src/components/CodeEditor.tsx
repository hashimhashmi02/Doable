"use client";
import Editor from "@monaco-editor/react";
import { useEffect } from "react";

export default function CodeEditor({ value }: { value: string }) {
  useEffect(() => {
    // Force dark theme
    document.documentElement.setAttribute('data-theme', 'vs-dark');
  }, []);

  return (
    <div className="rounded-xl border border-white/20 overflow-hidden">
      <Editor
        height="320px"
        defaultLanguage="typescript"
        value={value}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbers: "on",
          renderLineHighlight: "all",
          theme: "vs-dark",
        }}
      />
    </div>
  );
}

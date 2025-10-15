"use client";
import Editor from "@monaco-editor/react";

export default function CodeEditor({ value }: { value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-soft">
      <Editor
        height="320px"
        defaultLanguage="typescript"
        value={value}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

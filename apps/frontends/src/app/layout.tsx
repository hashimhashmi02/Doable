import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doable",
  description: "Doable — editor (read-only) Gemini LLM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased font-sans">{children}</body>
    </html>
  );
}

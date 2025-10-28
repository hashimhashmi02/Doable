import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doable - What will you build today?",
  description: "Create stunning apps & websites by chatting with AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

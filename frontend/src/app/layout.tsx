import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astro Stadium Order",
  description: "Intelligent Concession System powered by Gemini Agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-background to-background text-foreground selection:bg-primary/30">
        {children}
      </body>
    </html>
  );
}

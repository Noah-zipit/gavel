import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gavel · AI Courtroom",
  description:
    "Two advocate AI agents argue a group decision with real taste-graph evidence while a judge rules with receipts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memory Library",
  description: "Your study cards, chapters and mind maps across devices.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

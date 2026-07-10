import type { Metadata } from "next";
import "./globals.css";

const basePath = "/hoi4-focus-tree-designer";
const siteUrl = "https://hoi4-focus-tree-designer.snug-loon-2361.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "HOI4 Focus Tree Designer",
  description: "Plan, connect, import, and export Hearts of Iron IV focus trees in a visual browser-based editor.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    title: "HOI4 Focus Tree Designer",
    description: "Plan, connect, and export focus trees in a visual editor built for HOI4 modders.",
    type: "website",
    images: [{ url: `${basePath}/og.png`, width: 1731, height: 909, alt: "HOI4 Focus Tree Designer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HOI4 Focus Tree Designer",
    description: "Plan, connect, and export focus trees in a visual editor built for HOI4 modders.",
    images: [`${basePath}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

const basePath = "/hoi4-focus-tree-designer";

export const metadata: Metadata = {
  title: "HOI4 国策树设计器",
  description: "在可拖拽画布中设计、导入并导出 Hearts of Iron IV 国策树。",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
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

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loom",
  description: "기억이 보이고, 고칠 수 있는 AI 캐릭터 채팅",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

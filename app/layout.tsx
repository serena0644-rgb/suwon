import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수원 든든패스",
  description: "수원화성 교통약자 관광 통합 웹서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

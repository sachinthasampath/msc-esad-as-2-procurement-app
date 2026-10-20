import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcureX",
  description: "Office procurement console for construction sites",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

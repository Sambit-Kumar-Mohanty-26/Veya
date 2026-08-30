import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// The typeface the design actually uses. Variable font, so no `weight` list -
// that would fetch static instances instead of the variable file. The `opsz`
// axis is included so optical sizing adapts between 12px captions and the
// 32px heading, which is what the design relies on.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap"
});

export const metadata: Metadata = {
  title: "VedaAI — Question & Answer Mapping",
  description:
    "Upload a question paper and a handwritten answer sheet, then jump straight to the matching answer on the page."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={bricolage.variable}>
      <body>{children}</body>
    </html>
  );
}

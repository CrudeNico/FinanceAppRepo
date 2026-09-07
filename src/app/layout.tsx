import type { Metadata, Viewport } from "next";
import { RegisterSw } from "@/components/RegisterSw";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetworthApp",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Networth" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="min-h-dvh">
      <body className="min-h-dvh bg-[#E6E6E6]">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}

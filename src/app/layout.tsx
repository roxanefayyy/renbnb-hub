import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "RenBNB Hub",
  description: "RenBNB Operations Hub",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#393130", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Nav />
        <main className="md:pl-56 pb-24 md:pb-10">
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">{children}</div>
        </main>
      </body>
    </html>
  );
}

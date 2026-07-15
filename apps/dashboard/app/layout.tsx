import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppHeader } from "@/components/AppHeader";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "responder · incident dashboard",
  description: "Autonomous incident responder — live investigation, root-cause analysis, postmortems.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body
        suppressHydrationWarning
        className="h-screen overflow-hidden bg-bg text-text font-sans antialiased"
      >
        <Providers>
          <div className="flex h-full flex-col">
            <AppHeader />
            <main className="min-h-0 flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

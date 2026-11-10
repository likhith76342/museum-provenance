import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Museum Provenance",
  description: "Provenance and condition records for the Coromandel Heritage Museum",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && <Nav user={user} />}
        <main className="mx-auto w-full max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}

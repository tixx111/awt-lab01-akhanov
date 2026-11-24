import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Course Catalog",
  description: "A course catalog for Advanced Web Technologies",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
              Course Catalog
            </Link>
            <div className="flex gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <Link
                href="/"
                className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-indigo-700 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              >
                Home
              </Link>
              <Link
                href="/courses"
                className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-indigo-700 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              >
                Courses
              </Link>
              <Link
                href="/about"
                className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-indigo-700 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              >
                About
              </Link>
              <Link
                href="/filter"
                className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-indigo-700 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              >
                Filter
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Advanced Web Technologies | Akhanov Alisher IT3-2304
        </footer>
      </body>
    </html>
  );
}

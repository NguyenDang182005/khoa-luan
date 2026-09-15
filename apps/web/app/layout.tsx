import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Geist } from "next/font/google"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "HR Multi-Agent Platform",
  description: "HR Management System powered by NestJS, n8n and Gemini",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={cn("font-sans h-full", geist.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        {children}
      </body>
    </html>
  )
}

import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

// Inter + JetBrains Mono đều hỗ trợ subset "vietnamese" — hết cảnh chữ có dấu
// tiếng Việt rơi về font hệ thống (Geist cũ chỉ có subset latin nên font không đồng nhất).
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HR Multi-Agent Platform",
  description: "HR Management System powered by NestJS, n8n and Gemini",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable} font-sans h-full`}>
      <body className="h-full">{children}</body>
    </html>
  )
}

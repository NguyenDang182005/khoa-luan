import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Renderer tối giản cho nội dung chat AI (markdown nhẹ):
 * - **đậm**
 * - xuống dòng / bullet "- " hoặc "• "
 * Không dùng dangerouslySetInnerHTML; mọi thứ còn lại render như text.
 */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

export function RichText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const lines = String(text ?? "").split(/\r?\n/)
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {lines.map((line, index) => {
        const bullet = /^\s*[-•]\s+/.test(line)
        const content = bullet ? line.replace(/^\s*[-•]\s+/, "") : line
        return (
          <React.Fragment key={index}>
            {index > 0 && <br />}
            {bullet && <span className="mr-1 text-muted-foreground">•</span>}
            {renderInline(content)}
          </React.Fragment>
        )
      })}
    </div>
  )
}

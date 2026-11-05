import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-[22px] items-center gap-1 rounded-full border border-transparent px-2 text-caption font-medium whitespace-nowrap transition-colors [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary-tint text-accent-foreground",
        secondary: "bg-muted text-secondary-foreground",
        destructive: "bg-danger-tint text-danger",
        outline: "border-border bg-card text-secondary-foreground",
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-warning",
        info: "bg-info-tint text-info",
        ai: "bg-ai-tint text-ai",
        // Agent — teal=WF01 · blue=WF02 · amber=WF03 · coral=WF04
        teal: "rounded-sm bg-agent-wf01-tint text-agent-wf01",
        blue: "rounded-sm bg-agent-wf02-tint text-agent-wf02",
        amber: "rounded-sm bg-agent-wf03-tint text-agent-wf03",
        coral: "rounded-sm bg-agent-wf04-tint text-agent-wf04",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

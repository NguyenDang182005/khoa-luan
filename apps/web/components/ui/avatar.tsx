import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({
  className,
  initials,
  src,
  alt = "Avatar",
  bot = false,
  ...props
}: React.ComponentProps<"div"> & {
  initials?: string
  src?: string
  alt?: string
  bot?: boolean
}) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg font-semibold text-foreground text-xs select-none",
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="aspect-square size-full object-cover"
        />
      ) : (
        <span>{initials || "HR"}</span>
      )}
    </div>
  )
}

export { Avatar }

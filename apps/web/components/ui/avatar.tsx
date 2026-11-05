import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({
  className,
  initials,
  src,
  alt = "Avatar",
  ...props
}: React.ComponentProps<"div"> & {
  initials?: string
  src?: string
  alt?: string
}) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-secondary-foreground text-caption select-none",
        className
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar nhỏ 32px, không cần tối ưu LCP của next/image
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

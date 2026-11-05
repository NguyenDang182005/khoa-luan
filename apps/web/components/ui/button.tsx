import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-body-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:border-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-input bg-card text-secondary-foreground hover:bg-sunken hover:text-foreground aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-border aria-expanded:bg-border",
        ghost:
          "text-secondary-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "border-danger/40 bg-card text-danger hover:bg-danger-tint focus-visible:border-danger focus-visible:ring-danger/15",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-sm px-2 text-caption [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3",
        lg: "h-10 gap-2 px-4 text-body",
        icon: "size-9",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

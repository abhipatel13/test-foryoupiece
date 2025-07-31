import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 touch-manipulation cursor-pointer border",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white border-black hover:bg-white hover:text-black active:scale-[0.98]",
        destructive:
          "bg-black text-white border-black hover:bg-white hover:text-black active:scale-[0.98]",
        outline:
          "bg-white text-black border-black hover:bg-black hover:text-white active:scale-[0.98]",
        secondary:
          "bg-white text-black border-black hover:bg-black hover:text-white active:scale-[0.98]",
        ghost:
          "border-transparent hover:border-black hover:bg-white active:bg-black active:text-white",
        link: "text-black underline-offset-4 hover:underline p-0 h-auto border-transparent",
      },
      size: {
        default: "min-h-[44px] px-4 py-2 has-[>svg]:px-3 lg:min-h-[36px] lg:h-9 lg:px-3 lg:py-1.5", /* Mobile-first with min touch target */
        sm: "min-h-[36px] h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 lg:min-h-[32px] lg:h-8 lg:px-2.5 lg:gap-1", /* Smaller but still accessible */
        lg: "min-h-[48px] h-12 rounded-md px-6 has-[>svg]:px-4 lg:min-h-[40px] lg:h-10 lg:px-5", /* Larger touch target */
        icon: "min-w-[44px] min-h-[44px] size-11 lg:min-w-[36px] lg:min-h-[36px] lg:size-9", /* Square icon buttons with min touch target */
        xs: "min-h-[32px] h-8 px-2 py-1 text-xs has-[>svg]:px-1.5 lg:min-h-[28px] lg:h-7", /* Compact but still touchable */
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
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

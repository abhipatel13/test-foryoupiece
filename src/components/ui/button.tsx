import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 touch-manipulation cursor-pointer border rounded-md",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white border-black hover:bg-white hover:text-black active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
        outline:
          "bg-white text-black border-black hover:bg-black hover:text-white active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        secondary:
          "bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        ghost:
          "border-transparent hover:border-black hover:bg-muted active:bg-black active:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        link: "text-black underline-offset-4 hover:underline p-0 h-auto border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      },
      size: {
        default: "min-h-[44px] px-4 py-2 has-[>svg]:px-3 lg:min-h-[36px] lg:h-9 lg:px-3 lg:py-1.5", /* Mobile-first with min touch target */
        sm: "min-h-[36px] h-9 gap-1.5 px-3 has-[>svg]:px-2.5 lg:min-h-[32px] lg:h-8 lg:px-2.5 lg:gap-1", /* Smaller but still accessible */
        lg: "min-h-[48px] h-12 px-6 has-[>svg]:px-4 lg:min-h-[40px] lg:h-10 lg:px-5", /* Larger touch target */
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

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    loadingText,
    disabled,
    children,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    return (
      <Comp
        ref={ref}
        data-slot="button"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          loading && "cursor-wait",
          className
        )}
        {...props}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
            {loadingText || children}
          </div>
        ) : (
          children
        )}
      </Comp>
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }

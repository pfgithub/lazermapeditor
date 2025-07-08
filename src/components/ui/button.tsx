import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 ring-[hsl(217.2,91.2%,59.8%)]/20 outline-[hsl(217.2,91.2%,59.8%)]/40 focus-visible:ring-4 focus-visible:outline-1 aria-invalid:focus-visible:ring-0",
  {
    variants: {
      variant: {
        default: "bg-[hsl(217.2,91.2%,59.8%)] text-[hsl(210,40%,98%)] shadow-sm hover:bg-[hsl(217.2,91.2%,59.8%)]/90",
        destructive: "bg-[hsl(0,62.8%,30.6%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(0,62.8%,30.6%)]/90",
        outline: "border border-[hsl(217.2,32.6%,17.5%)] bg-[hsl(222.2,84%,4.9%)] hover:bg-[hsl(217.2,32.6%,17.5%)] hover:text-[hsl(210,40%,98%)]",
        secondary: "bg-[hsl(217.2,32.6%,17.5%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(217.2,32.6%,17.5%)]/80",
        ghost: "hover:bg-[hsl(217.2,32.6%,17.5%)] hover:text-[hsl(210,40%,98%)]",
        link: "text-[hsl(217.2,91.2%,59.8%)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };

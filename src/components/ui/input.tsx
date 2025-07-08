import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-[hsl(217.2,32.6%,17.5%)] file:text-[hsl(210,40%,98%)] placeholder:text-[hsl(215,20.2%,65.1%)] selection:bg-[hsl(217.2,91.2%,59.8%)] selection:text-[hsl(210,40%,98%)] aria-invalid:outline-[hsl(0,62.8%,30.6%)] aria-invalid:ring-[hsl(0,62.8%,30.6%)]/50 ring-[hsl(217.2,91.2%,59.8%)]/20 outline-[hsl(217.2,91.2%,59.8%)]/40 aria-invalid:outline-[hsl(0,62.8%,30.6%)] aria-invalid:ring-[hsl(0,62.8%,30.6%)]/40 aria-invalid:border-[hsl(0,62.8%,30.6%)] flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-4 focus-visible:outline-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:focus-visible:ring-[3px] aria-invalid:focus-visible:outline-none md:text-sm aria-invalid:focus-visible:ring-4",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

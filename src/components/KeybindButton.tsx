import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KeybindButtonProps {
  value: string | undefined;
  onValueChange: (key: string | undefined) => void;
  className?: string;
}

export function KeybindButton({ value, onValueChange, className }: KeybindButtonProps) {
  const [isBinding, setIsBinding] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isBinding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't allow binding modifier keys alone
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      onValueChange(e.code);
      setIsBinding(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsBinding(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isBinding, onValueChange]);

  const handleClick = () => {
    if (isBinding) {
      // Clicked while listening: clear the keybind
      onValueChange(undefined);
      setIsBinding(false);
    } else {
      // Start listening
      setIsBinding(true);
    }
  };

  return (
    <Button
      ref={buttonRef}
      variant="outline"
      onClick={handleClick}
      className={cn("flex-1 justify-start font-mono", className)}
    >
      {isBinding ? "Press a key..." : value || "Unbound"}
    </Button>
  );
}

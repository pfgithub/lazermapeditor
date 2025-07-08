import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function allowKeyEvent(e: KeyboardEvent): boolean {
  const activeEl = document.activeElement;
  if (
    activeEl &&
    ((activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "text") ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.tagName === "SELECT")
  ) {
    return false;
  }
  return true;
}

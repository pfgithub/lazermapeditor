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

export function svRemap(t: number, from: number, to: number): number {
  if(t < from) return t / from * to;
  return (t - from) / (1 - from) * (1 - to) + to;
}

export function svCalculate(from: number, to: number): {startRatio: number, endRatio: number, durationRatio: number, error: boolean} {
  const startRatio = +(to / from).toFixed(2);
  const durationRatio = from;
  const firstSvChange = startRatio;
  const destinationRate = 1;
  const endRatio = (destinationRate - firstSvChange * durationRatio) / (1 - durationRatio);
  const error = startRatio > 10 || startRatio < 0.01 || endRatio > 10 || endRatio < 0.01;
  return {startRatio, endRatio, durationRatio, error};
}

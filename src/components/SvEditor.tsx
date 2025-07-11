/**
 * Interactive editor for SV (Scroll Velocity) patterns.
 * Renders a draggable point on a 2D plane to control the shape of an SV curve.
 */
import React, { useRef, useEffect, useCallback } from "react";
import { cn, svCalculate } from "@/lib/utils";

interface SvEditorProps {
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  className?: string;
}

const HANDLE_RADIUS = 5;

export function SvEditor({ from, to, onChange, className }: SvEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width: cssWidth, height: cssHeight } = canvas.getBoundingClientRect();
    if (cssWidth === 0) return;

    const { width, height } = canvas; // internal resolution

    // Clear canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.restore();

    // Background
    ctx.fillStyle = "hsl(222.2, 84%, 4.9%)";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Border
    ctx.strokeStyle = "hsl(217.2, 32.6%, 17.5%)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssWidth - 1, cssHeight - 1);

    // The graph line
    ctx.strokeStyle = "hsl(217.2, 91.2%, 59.8%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cssHeight); // (0,0) in math coords is bottom-left. Y is inverted.
    ctx.lineTo(from * cssWidth, cssHeight - to * cssHeight);
    ctx.lineTo(cssWidth, 0); // (1,1) in math coords is top-right
    ctx.stroke();

    // The handle
    const handleX = from * cssWidth;
    const handleY = cssHeight - to * cssHeight;
    ctx.beginPath();
    ctx.arc(handleX, handleY, HANDLE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = "hsl(210, 40%, 98%)";
    ctx.fill();
    ctx.strokeStyle = "hsl(217.2, 91.2%, 59.8%)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [from, to]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d");
        ctx?.scale(dpr, dpr);
        draw();
      }
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      const updateValue = (moveEvent: MouseEvent) => {
        const x = moveEvent.clientX - rect.left;
        const y = moveEvent.clientY - rect.top;
        const newFrom = Math.max(0, Math.min(1, x / rect.width));
        const newTo = Math.max(0, Math.min(1, (rect.height - y) / rect.height));
        onChange(newFrom, newTo);
      };

      updateValue(e.nativeEvent);

      const onMouseMove = (moveEvent: MouseEvent) => {
        updateValue(moveEvent);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [onChange],
  );

  const {startRatio, endRatio, error} = svCalculate(from, to);

  return <div className="flex gap-2">
    <canvas
      ref={canvasRef}
      className={cn("w-24 aspect-square cursor-pointer", className)}
      onMouseDown={onMouseDown}
    />
    <div className="flex flex-col flex-1">
      <div>from: {from.toFixed(2)} / to: {to.toFixed(2)}</div>
      <div>start: {startRatio.toFixed(2)}x / end: {endRatio.toFixed(2)}x</div>
      <div className="text-red-500">{error ? "Error! SV too powerful!" : " "}</div>
    </div>
  </div>;
}

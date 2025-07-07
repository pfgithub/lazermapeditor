import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Map } from "@/store";
import {
  calculateTimingPointsInRange,
  findNextSnap,
  findPreviousSnap,
  getColorForSnap,
  getSnapForTime,
  snapLevels,
  type Snap,
} from "@/lib/timingPoints";

interface DesignTabProps {
  map: Map;
  audioRef: React.RefObject<HTMLAudioElement>;
  snap: Snap;
  setSnap: (snap: Snap) => void;
}

export function DesignTab({ map, audioRef, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

  // Main drawing function, called every frame.
  const draw = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio;
    ctx.save();
    ctx.scale(dpr, dpr);

    // --- Draw Columns for 4K ---
    const numLanes = 4;
    const laneWidth = width / numLanes;
    ctx.strokeStyle = "hsl(var(--border))";
    ctx.lineWidth = 1;
    for (let i = 1; i < numLanes; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, height);
      ctx.stroke();
    }

    const startTime = time - 0.1;
    const endTime = time + 1.0;

    const posToY = (lineTime: number) => {
      return height - ((lineTime - startTime) / (endTime - startTime)) * height;
    };

    const timingPoints = calculateTimingPointsInRange(map, startTime, endTime, snap);
    for (const timingPoint of timingPoints) {
      const pointSnap = getSnapForTime(map, timingPoint);
      let strokeStyle = getColorForSnap(pointSnap);
      let lineWidth = 1;

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = strokeStyle;

      const y = posToY(timingPoint);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // --- Draw Judgement Line ---
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 3;
    const judgementY = posToY(time);
    ctx.beginPath();
    ctx.moveTo(0, judgementY);
    ctx.lineTo(width, judgementY);
    ctx.stroke();

    ctx.restore();
  };

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    const loop = () => {
      const time = audioRef.current?.currentTime ?? 0;
      draw(time);
      animationFrameId.current = requestAnimationFrame(loop);
    };
    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [map, snap, audioRef]); // Re-run if any of these change

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      draw(audioRef.current?.currentTime ?? 0);
    });
    resizeObserver.observe(container);

    // Initial resize
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    return () => resizeObserver.disconnect();
  }, [audioRef]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!audioRef.current) return;
    e.preventDefault();

    const currentTime = audioRef.current.currentTime;
    let nextTime: number | null = null;

    if (e.deltaY > 0) {
      // Scroll down -> forward in time
      nextTime = findNextSnap(map, currentTime, snap);
    } else {
      // Scroll up -> backward in time
      nextTime = findPreviousSnap(map, currentTime, snap);
    }

    if (nextTime !== null) {
      audioRef.current.currentTime = nextTime;
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between p-2 bg-card border rounded-lg shrink-0">
        <div className="flex items-center gap-2">
          <Label>Snap:</Label>
          {snapLevels.map((level) => (
            <Button key={level} variant={snap === level ? "default" : "outline"} size="sm" onClick={() => setSnap(level)}>
              1/{level}
            </Button>
          ))}
        </div>
      </div>

      <div
        className="flex-grow relative bg-card border rounded-lg overflow-hidden"
        ref={containerRef}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </div>
    </div>
  );
}

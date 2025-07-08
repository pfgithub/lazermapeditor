import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Key, Map } from "@/store";
import {
  calculateTimingPointsInRange,
  findNearestSnap,
  findNextSnap,
  findPreviousSnap,
  getColorForSnap,
  getSnapForTime,
  snapLevels,
  type Snap,
} from "@/lib/timingPoints";

interface DesignTabProps {
  map: Map;
  setMap: (map: Map) => void;
  currentTime: number;
  seek: (time: number) => void;
  snap: Snap;
  setSnap: (snap: Snap) => void;
}

export function DesignTab({ map, setMap, currentTime, seek, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeHoldsRef = useRef<Partial<Record<0 | 1 | 2 | 3, number>>>({});

  // Main drawing function, called every frame.
  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0 || height === 0) return;

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

      // --- Draw Keys ---
      for (const key of map.keys) {
        if (key.endTime < startTime || key.startTime > endTime) {
          continue;
        }
        const y_start = posToY(key.startTime);
        const y_end = posToY(key.endTime);
        const x_start = key.key * laneWidth;
        const color = getColorForSnap(getSnapForTime(map, key.startTime));

        if (key.startTime === key.endTime) {
          // Tap Note
          ctx.strokeStyle = color;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(x_start + 5, y_start);
          ctx.lineTo(x_start + laneWidth - 5, y_start);
          ctx.stroke();
        } else {
          // Hold Note
          const noteWidth = laneWidth - 10;
          ctx.fillStyle = color + "80"; // semi-transparent
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.fillRect(x_start + 5, y_end, noteWidth, y_start - y_end);
          ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
        }
      }

      // --- Draw Judgement Line ---
      ctx.strokeStyle = getColorForSnap(getSnapForTime(map, time));
      ctx.lineWidth = 3;
      const judgementY = posToY(time);
      ctx.beginPath();
      ctx.moveTo(0, judgementY);
      ctx.lineTo(width, judgementY);
      ctx.stroke();

      ctx.restore();
    },
    [map, snap],
  );

  useEffect(() => {
    const keyMap: { [key: string]: 0 | 1 | 2 | 3 } = {
      d: 0,
      f: 1,
      j: 2,
      k: 3,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyIndex = keyMap[e.key.toLowerCase()];
      if (keyIndex === undefined || e.repeat) return;
      if (document.activeElement?.tagName === "INPUT") return;

      if (activeHoldsRef.current[keyIndex] !== undefined) return;

      const nearestTime = findNearestSnap(map, currentTime, snap);
      if (nearestTime === null) return;

      e.preventDefault();
      activeHoldsRef.current[keyIndex] = nearestTime;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyIndex = keyMap[e.key.toLowerCase()];
      if (keyIndex === undefined) return;
      if (document.activeElement?.tagName === "INPUT") return;

      const startTime = activeHoldsRef.current[keyIndex];
      if (startTime === undefined) return;

      delete activeHoldsRef.current[keyIndex];

      const endTime = findNearestSnap(map, currentTime, snap);
      if (endTime === null) return;

      const newKey: Key = {
        startTime,
        endTime: Math.max(startTime, endTime),
        key: keyIndex,
      };

      if (map.keys.some((k) => k.startTime === newKey.startTime && k.key === newKey.key)) {
        return;
      }

      const newKeys = [...map.keys, newKey].sort((a, b) => a.startTime - b.startTime);
      setMap({ ...map, keys: newKeys });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [map, setMap, currentTime, snap]);

  // Redraw canvas whenever time changes
  useEffect(() => {
    draw(currentTime);
  }, [currentTime, draw]);

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const performResize = () => {
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
      if (containerWidth === 0 || containerHeight === 0) return;

      const dpr = window.devicePixelRatio;
      const targetAspectRatio = 9 / 16;

      let canvasWidth = containerWidth;
      let canvasHeight = canvasWidth / targetAspectRatio;

      if (canvasHeight > containerHeight) {
        canvasHeight = containerHeight;
        canvasWidth = canvasHeight * targetAspectRatio;
      }

      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;

      canvas.style.left = `${(containerWidth - canvasWidth) / 2}px`;
      canvas.style.top = `${(containerHeight - canvasHeight) / 2}px`;

      draw(currentTime);
    };

    const resizeObserver = new ResizeObserver(performResize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [draw, currentTime]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!seek) return;
    e.preventDefault();

    let nextTime: number | null = null;

    if (e.deltaY > 0) {
      // Scroll down -> forward in time
      nextTime = findNextSnap(map, currentTime, snap);
    } else {
      // Scroll up -> backward in time
      nextTime = findPreviousSnap(map, currentTime, snap);
    }

    if (nextTime !== null) {
      seek(nextTime);
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
        <canvas ref={canvasRef} className="absolute" />
      </div>
    </div>
  );
}

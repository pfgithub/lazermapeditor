import { useCallback, useEffect, useRef, useState } from "react";
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

const getKeyId = (key: Key): string => `${key.startTime}-${key.key}`;

export function DesignTab({ map, setMap, currentTime, seek, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeHoldsRef = useRef<Partial<Record<0 | 1 | 2 | 3, number>>>({});
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set());

  // State for box selection
  const [selectionBox, setSelectionBox] = useState<{ x1: number; t1: number; x2: number; t2: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Memoized function to convert time to a Y-coordinate on the canvas
  const posToY = useCallback(
    (lineTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const { height } = canvas.getBoundingClientRect();
      if (height === 0) return 0;
      const startTime = currentTime - 0.1;
      const endTime = currentTime + 1.0;
      return height - ((lineTime - startTime) / (endTime - startTime)) * height;
    },
    [currentTime],
  );
  const yToPos = useCallback(
    (y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return 0; // Or handle as an error, depending on desired behavior
      const { height } = canvas.getBoundingClientRect();
      if (height === 0) return 0; // Or handle as an error

      const startTime = currentTime - 0.1;
      const endTime = currentTime + 1.0;

      if (height === 0) return startTime;

      const lineTime = startTime + ((height - y) / height) * (endTime - startTime);
      return lineTime;
    },
    [currentTime],
  );

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
        const keyId = getKeyId(key);
        const isSelected = selectedKeyIds.has(keyId);

        if (key.startTime === key.endTime) {
          // Tap Note
          ctx.strokeStyle = color;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(x_start + 5, y_start);
          ctx.lineTo(x_start + laneWidth - 5, y_start);
          ctx.stroke();

          if (isSelected) {
            ctx.strokeStyle = "hsl(var(--ring))";
            ctx.lineWidth = 2;
            ctx.strokeRect(x_start + 3, y_start - 5, laneWidth - 6, 10);
          }
        } else {
          // Hold Note
          const noteWidth = laneWidth - 10;
          ctx.fillStyle = color + "80"; // semi-transparent
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.fillRect(x_start + 5, y_end, noteWidth, y_start - y_end);
          ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);

          if (isSelected) {
            ctx.strokeStyle = "hsl(var(--ring))";
            ctx.lineWidth = 4;
            ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
          }
        }
      }

      // --- Draw Selection Box ---
      if (selectionBox) {
        const { x1, t1, x2, t2 } = selectionBox;
        const y1 = posToY(t1);
        const y2 = posToY(t2);
        ctx.fillStyle = "hsla(var(--ring), 0.2)";
        ctx.strokeStyle = "hsl(var(--ring))";
        ctx.lineWidth = 1;
        const rectX = Math.min(x1, x2);
        const rectY = Math.min(y1, y2);
        const rectW = Math.abs(x1 - x2);
        const rectH = Math.abs(y1 - y2);
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
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
    [map, snap, selectedKeyIds, posToY, selectionBox],
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
      const activeEl = document.activeElement;
      if (
        activeEl &&
        ((activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "text") ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "BUTTON")
      ) {
        return;
      }

      if (activeHoldsRef.current[keyIndex] !== undefined) return;

      const nearestTime = findNearestSnap(map, currentTime, snap);
      if (nearestTime === null) return;

      e.preventDefault();
      activeHoldsRef.current[keyIndex] = nearestTime;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyIndex = keyMap[e.key.toLowerCase()];
      if (keyIndex === undefined) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        ((activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "text") ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "BUTTON")
      ) {
        return;
      }

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

  // Key deletion handler
  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (selectedKeyIds.size === 0) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        ((activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "text") ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "BUTTON")
      ) {
        return;
      }

      e.preventDefault();

      const newKeys = map.keys.filter((key) => !selectedKeyIds.has(getKeyId(key)));

      setMap({ ...map, keys: newKeys });
      setSelectedKeyIds(new Set());
    };

    window.addEventListener("keydown", handleDelete);
    return () => {
      window.removeEventListener("keydown", handleDelete);
    };
  }, [map, setMap, selectedKeyIds]);

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

  const getKeysInBox = useCallback(
    (x1: number, t1: number, x2: number, t2: number): Key[] => {
      const canvas = canvasRef.current;
      if (!canvas) return [];
      const y1 = posToY(t1);
      const y2 = posToY(t2);

      const rect = canvas.getBoundingClientRect();
      const numLanes = 4;
      const laneWidth = rect.width / numLanes;

      const boxLeft = Math.min(x1, x2);
      const boxRight = Math.max(x1, x2);
      const boxTop = Math.min(y1, y2);
      const boxBottom = Math.max(y1, y2);

      const viewStartTime = currentTime - 0.1;
      const viewEndTime = currentTime + 1.0;

      const selectedKeys: Key[] = [];
      for (const key of map.keys) {
        if (key.endTime < viewStartTime || key.startTime > viewEndTime) continue;

        const keyLeft = key.key * laneWidth;
        const keyRight = (key.key + 1) * laneWidth;

        if (keyLeft > boxRight || keyRight < boxLeft) continue;

        const y_start = posToY(key.startTime);
        const y_end = posToY(key.endTime);

        const isTap = key.startTime === key.endTime;
        if (isTap) {
          // Tap notes are thin, give them some vertical tolerance for selection
          const keyRectTop = y_start - 5;
          const keyRectBottom = y_start + 5;
          if (keyRectTop < boxBottom && keyRectBottom > boxTop) {
            selectedKeys.push(key);
          }
        } else {
          // AABB collision detection. y_end is top, y_start is bottom of note on screen.
          if (y_end < boxBottom && y_start > boxTop) {
            selectedKeys.push(key);
          }
        }
      }
      return selectedKeys;
    },
    [map.keys, currentTime, posToY],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const numLanes = 4;
      const laneWidth = rect.width / numLanes;
      const lane = Math.floor(x / laneWidth);

      const viewStartTime = currentTime - 0.1;
      const viewEndTime = currentTime + 1.0;

      let clickedKey: Key | null = null;
      let minDistance = Infinity; // distance in pixels on Y axis

      // Iterate over visible keys to find a match
      for (const key of map.keys) {
        if (key.key !== lane) continue;
        if (key.endTime < viewStartTime || key.startTime > viewEndTime) continue;

        const y_start = posToY(key.startTime);
        const y_end = posToY(key.endTime);

        const isTap = key.startTime === key.endTime;
        // For taps, give a small clickable height. For holds, check if click is within the rectangle.
        const isYInRange = isTap
          ? y >= y_start - 5 && y <= y_start + 5 // 10px height for clicking taps
          : y >= y_end && y <= y_start;

        if (isYInRange) {
          const y_center = isTap ? y_start : (y_start + y_end) / 2;
          const distance = Math.abs(y - y_center);
          if (distance < minDistance) {
            minDistance = distance;
            clickedKey = key;
          }
        }
      }

      if (clickedKey) {
        const keyId = getKeyId(clickedKey);
        const newSelection = new Set(selectedKeyIds);
        const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;

        if (isMultiSelect) {
          if (newSelection.has(keyId)) {
            newSelection.delete(keyId);
          } else {
            newSelection.add(keyId);
          }
        } else {
          if (!newSelection.has(keyId)) {
            newSelection.clear();
            newSelection.add(keyId);
          }
          // If it is already selected, do nothing, to allow for future drag-and-drop.
        }
        setSelectedKeyIds(newSelection);
      } else {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedKeyIds(new Set());
        }
      }
    },
    [map.keys, currentTime, selectedKeyIds, posToY],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionBox({ x1: x, t1: yToPos(y), x2: x, t2: yToPos(y) });
  }, [yToPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionBox((prev) => {
      if (!prev) return null;
      return { ...prev, x2: x, t2: yToPos(y) };
    });
  }, [yToPos]);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      if (!selectionBox) return;

      const { x1, t1, x2, t2 } = selectionBox;
      const y1 = posToY(t1);
      const y2 = posToY(t2);
      const dragDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

      if (dragDistance < 5) {
        // It's a click
        handleClick(e as any);
      } else {
        // It's a drag-select
        const keysInBox = getKeysInBox(x1, t1, x2, t2);
        const keyIdsInBox = new Set(keysInBox.map(getKeyId));

        const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
        if (isMultiSelect) {
          const newSelection = new Set(selectedKeyIds);
          keyIdsInBox.forEach((id) => newSelection.add(id));
          setSelectedKeyIds(newSelection);
        } else {
          setSelectedKeyIds(keyIdsInBox);
        }
      }
      setSelectionBox(null);
    },
    [selectionBox, handleClick, getKeysInBox, selectedKeyIds, posToY],
  );

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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} className="absolute" onMouseDown={handleMouseDown} />
      </div>
    </div>
  );
}

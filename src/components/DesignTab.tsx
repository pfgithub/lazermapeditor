import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Key, Map } from "@/store";
import { findNearestSnap, findNextSnap, findPreviousSnap, snapLevels, type Snap } from "@/lib/timingPoints";
import { DesignCanvasController } from "@/lib/DesignCanvasController";

interface DesignTabProps {
  map: Map;
  setMap: (map: Map) => void;
  getCurrentTime: () => number;
  seek: (time: number) => void;
  snap: Snap;
  setSnap: (snap: Snap) => void;
}

const getKeyId = (key: Key): string => `${key.startTime}-${key.key}`;

export function DesignTab({ map, setMap, getCurrentTime, seek, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DesignCanvasController | null>(null);

  const activeHoldsRef = useRef<Partial<Record<0 | 1 | 2 | 3, number>>>({});
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set());

  // For visual feedback during drag
  const [draggedKeysPreview, setDraggedKeysPreview] = useState<Key[] | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; t1: number; x2: number; t2: number } | null>(null);

  const [themeColors, setThemeColors] = useState({
    border: "hsl(217.2 32.6% 17.5%)",
    ring: "hsl(217.2 91.2% 59.8%)",
    ringTransparent: "hsla(217.2 91.2% 59.8% / 0.2)",
  });

  // Initialize and update canvas controller
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!controllerRef.current) {
      controllerRef.current = new DesignCanvasController({
        canvas,
        map,
        getCurrentTime,
        snap,
        selectedKeyIds,
        draggedKeysPreview,
        selectionBox,
        themeColors,
        activeHolds: activeHoldsRef.current,
        // Callbacks to update component state
        setMap,
        setSelectedKeyIds,
        setDraggedKeysPreview,
        setSelectionBox,
      });
    } else {
      controllerRef.current.update({
        map,
        snap,
        selectedKeyIds,
        draggedKeysPreview,
        selectionBox,
        themeColors,
        activeHolds: activeHoldsRef.current,
      });
    }
  }); // Runs on every render to keep controller props in sync

  // Main drawing loop
  useEffect(() => {
    let animationFrame: number;
    const loop = () => {
      controllerRef.current?.draw();
      animationFrame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

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
          activeEl.tagName === "SELECT")
      ) {
        return;
      }

      if (activeHoldsRef.current[keyIndex] !== undefined) return;

      const nearestTime = findNearestSnap(map, getCurrentTime(), snap);
      if (nearestTime === null) return;

      e.preventDefault();
      activeHoldsRef.current[keyIndex] = nearestTime;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyIndex = keyMap[e.key.toLowerCase()];
      if (keyIndex === undefined) return;

      const startTime = activeHoldsRef.current[keyIndex];
      if (startTime === undefined) return;

      delete activeHoldsRef.current[keyIndex];

      const endTime = findNearestSnap(map, getCurrentTime(), snap);
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
  }, [map, setMap, snap, getCurrentTime]);

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

      controllerRef.current?.draw();
    };

    const resizeObserver = new ResizeObserver(performResize);
    resizeObserver.observe(container);

    performResize();

    return () => resizeObserver.disconnect();
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (!seek) return;
    e.preventDefault();

    let nextTime: number | null = null;

    if (e.deltaY > 0) {
      // Scroll down -> forward in time
      nextTime = findNextSnap(map, getCurrentTime(), snap);
    } else {
      // Scroll up -> backward in time
      nextTime = findPreviousSnap(map, getCurrentTime(), snap);
    }

    if (nextTime !== null) {
      seek(nextTime);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    controllerRef.current?.handleMouseDown(e.nativeEvent);
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    controllerRef.current?.handleMouseMove(e.nativeEvent);
  };
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    controllerRef.current?.handleMouseUp(e.nativeEvent);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between p-3 bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-lg shrink-0">
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
        className="flex-grow relative bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-lg overflow-hidden"
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

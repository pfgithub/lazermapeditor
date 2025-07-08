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
  getCurrentTime: () => number;
  seek: (time: number) => void;
  snap: Snap;
  setSnap: (snap: Snap) => void;
}

const getKeyId = (key: Key): string => `${key.startTime}-${key.key}`;

export function DesignTab({ map, setMap, getCurrentTime, seek, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeHoldsRef = useRef<Partial<Record<0 | 1 | 2 | 3, number>>>({});
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set());

  // State for dragging notes or box selection
  const dragContextRef = useRef<{
    type: "select";
    x1: number;
    t1: number;
  } | {
    type: "drag";
    initialMouseTime: number;
    initialMouseLane: number;
    originalKeys: Map<string, Key>; // Map from key ID to original key object
  } | null>(null);

  // For visual feedback during drag
  const [draggedKeysPreview, setDraggedKeysPreview] = useState<Key[] | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; t1: number; x2: number; t2: number } | null>(null);

  const [themeColors, setThemeColors] = useState({
    border: "hsl(217.2 32.6% 17.5%)",
    ring: "hsl(217.2 91.2% 59.8%)",
    ringTransparent: "hsla(217.2 91.2% 59.8%, 0.2)",
  });

  // Memoized function to convert time to a Y-coordinate on the canvas
  const posToY = useCallback(
    (lineTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const { height } = canvas.getBoundingClientRect();
      if (height === 0) return 0;
      const startTime = getCurrentTime() - 0.1;
      const endTime = getCurrentTime() + 1.0;
      return height - ((lineTime - startTime) / (endTime - startTime)) * height;
    },
    [],
  );
  const yToPos = useCallback(
    (y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return 0; // Or handle as an error, depending on desired behavior
      const { height } = canvas.getBoundingClientRect();
      if (height === 0) return 0; // Or handle as an error

      const startTime = getCurrentTime() - 0.1;
      const endTime = getCurrentTime() + 1.0;

      if (height === 0) return startTime;

      const lineTime = startTime + ((height - y) / height) * (endTime - startTime);
      return lineTime;
    },
    [getCurrentTime()],
  );

  const findKeyAt = useCallback(
    (x: number, y: number): Key | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const numLanes = 4;
      const laneWidth = rect.width / numLanes;
      const lane = Math.floor(x / laneWidth);

      const viewStartTime = getCurrentTime() - 0.1;
      const viewEndTime = getCurrentTime() + 1.0;

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
      return clickedKey;
    },
    [map.keys, posToY, getCurrentTime],
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
      ctx.strokeStyle = themeColors.border;
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
        const keyId = getKeyId(key);
        // If this key is being dragged, we draw the preview version later.
        if (draggedKeysPreview && dragContextRef.current?.type === "drag" && dragContextRef.current.originalKeys.has(keyId)) {
          continue;
        }

        if (key.endTime < startTime || key.startTime > endTime) {
          continue;
        }
        const y_start = posToY(key.startTime);
        const y_end = posToY(key.endTime);
        const x_start = key.key * laneWidth;
        const color = getColorForSnap(getSnapForTime(map, key.startTime));
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
            ctx.strokeStyle = themeColors.ring;
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
            ctx.strokeStyle = themeColors.ring;
            ctx.lineWidth = 4;
            ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
          }
        }
      }
      
      // --- Draw Dragged Keys Preview ---
      if (draggedKeysPreview) {
        for (const key of draggedKeysPreview) {
          if (key.endTime < startTime || key.startTime > endTime) {
            continue;
          }
          const y_start = posToY(key.startTime);
          const y_end = posToY(key.endTime);
          const x_start = key.key * laneWidth;
          const color = getColorForSnap(getSnapForTime(map, key.startTime));

          if (key.startTime === key.endTime) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(x_start + 5, y_start);
            ctx.lineTo(x_start + laneWidth - 5, y_start);
            ctx.stroke();
            ctx.strokeStyle = themeColors.ring;
            ctx.lineWidth = 2;
            ctx.strokeRect(x_start + 3, y_start - 5, laneWidth - 6, 10);
          } else {
            const noteWidth = laneWidth - 10;
            ctx.fillStyle = color + "80";
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.fillRect(x_start + 5, y_end, noteWidth, y_start - y_end);
            ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
            ctx.strokeStyle = themeColors.ring;
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
        ctx.fillStyle = themeColors.ringTransparent;
        ctx.strokeStyle = themeColors.ring;
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
    [map, snap, selectedKeyIds, posToY, selectionBox, themeColors, draggedKeysPreview],
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

      const nearestTime = findNearestSnap(map, getCurrentTime(), snap);
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
  }, [map, setMap, snap]);

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
    let animationFrame: number;
    const next = () => {
      draw(getCurrentTime());
      animationFrame = requestAnimationFrame(next);
    };
    next();
    return () => cancelAnimationFrame(animationFrame);
  }, [draw, getCurrentTime]);

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

      draw(getCurrentTime());
    };

    const resizeObserver = new ResizeObserver(performResize);
    resizeObserver.observe(container);

    // Initial resize
    performResize();

    return () => resizeObserver.disconnect();
  }, [draw, getCurrentTime]);

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

      const viewStartTime = getCurrentTime() - 0.1;
      const viewEndTime = getCurrentTime() + 1.0;

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
    [map.keys, posToY, getCurrentTime],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const numLanes = 4;
      const laneWidth = rect.width / numLanes;

      const clickedKey = findKeyAt(x, y);
      const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;

      if (clickedKey) {
        const keyId = getKeyId(clickedKey);
        const isSelected = selectedKeyIds.has(keyId);
        let nextSelectedKeyIds = new Set(selectedKeyIds);
        let selectionChanged = false;

        if (isMultiSelect) {
          if (isSelected) {
            nextSelectedKeyIds.delete(keyId);
          } else {
            nextSelectedKeyIds.add(keyId);
          }
          selectionChanged = true;
        } else {
          if (!isSelected || selectedKeyIds.size > 1) {
            nextSelectedKeyIds = new Set([keyId]);
            selectionChanged = true;
          }
        }

        if (selectionChanged) {
          setSelectedKeyIds(nextSelectedKeyIds);
        }

        // Only start a drag if we're not deselecting with a multi-select key.
        if (isMultiSelect && isSelected) {
          dragContextRef.current = null;
        } else {
          const keysToDrag = new Map<string, Key>();
          map.keys.forEach((k) => {
            if (nextSelectedKeyIds.has(getKeyId(k))) {
              keysToDrag.set(getKeyId(k), k);
            }
          });

          dragContextRef.current = {
            type: "drag",
            initialMouseTime: yToPos(y),
            initialMouseLane: Math.floor(x / laneWidth),
            originalKeys: keysToDrag,
          };
        }
      } else {
        // No key clicked, start box selection
        if (!isMultiSelect) {
          setSelectedKeyIds(new Set());
        }
        dragContextRef.current = {
          type: "select",
          x1: x,
          t1: yToPos(y),
        };
        setSelectionBox({ x1: x, t1: yToPos(y), x2: x, t2: yToPos(y) });
      }
    },
    [findKeyAt, map.keys, selectedKeyIds, yToPos, snap],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragContextRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const context = dragContextRef.current;
      if (context.type === "select") {
        setSelectionBox((prev) => {
          if (!prev) return null;
          return { ...prev, x2: x, t2: yToPos(y) };
        });
      } else {
        // type is 'drag'
        const numLanes = 4;
        const laneWidth = rect.width / numLanes;
        const currentTime = yToPos(y);
        const currentLane = Math.floor(x / laneWidth);

        const timeDelta = currentTime - context.initialMouseTime;
        const laneDelta = currentLane - context.initialMouseLane;

        const minKey = Math.min(...Array.from(context.originalKeys.values()).map((k) => k.key));
        const maxKey = Math.max(...Array.from(context.originalKeys.values()).map((k) => k.key));

        let adjustedLaneDelta = laneDelta;
        if (minKey + laneDelta < 0) {
          adjustedLaneDelta = -minKey;
        }
        if (maxKey + laneDelta >= numLanes) {
          adjustedLaneDelta = numLanes - 1 - maxKey;
        }

        const newKeys: Key[] = [];
        for (const originalKey of context.originalKeys.values()) {
          const newStartTime = originalKey.startTime + timeDelta;
          const snappedStartTime = findNearestSnap(map, newStartTime, snap);

          if (snappedStartTime === null) continue;

          const snappedTimeDelta = snappedStartTime - originalKey.startTime;

          newKeys.push({
            ...originalKey,
            startTime: originalKey.startTime + snappedTimeDelta,
            endTime: originalKey.endTime + snappedTimeDelta,
            key: (originalKey.key + adjustedLaneDelta) as Key["key"],
          });
        }
        setDraggedKeysPreview(newKeys);
      }
    },
    [yToPos, map, snap],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragContextRef.current) return;
      const context = dragContextRef.current;

      if (context.type === "select") {
        if (selectionBox) {
          const { x1, t1, x2, t2 } = selectionBox;
          const y1 = posToY(t1);
          const y2 = posToY(t2);
          const dragDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

          if (dragDistance > 5) {
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
        }
        setSelectionBox(null);
      } else {
        // type is 'drag'
        if (draggedKeysPreview) {
          const draggedKeyOriginalIds = new Set(context.originalKeys.keys());
          const otherKeys = map.keys.filter((k) => !draggedKeyOriginalIds.has(getKeyId(k)));

          const newKeys = [...otherKeys, ...draggedKeysPreview].sort((a, b) => a.startTime - b.startTime);
          setMap({ ...map, keys: newKeys });

          const newSelectedKeyIds = new Set(draggedKeysPreview.map(getKeyId));
          setSelectedKeyIds(newSelectedKeyIds);
        }
        setDraggedKeysPreview(null);
      }
      dragContextRef.current = null;
    },
    [selectionBox, getKeysInBox, selectedKeyIds, map, setMap, draggedKeysPreview, posToY],
  );

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

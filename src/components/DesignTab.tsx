import { useCallback, useEffect, useRef, useState } from "react";
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
        draggedOriginalKeys: null,
        selectionBox,
        themeColors,
        activeHolds: activeHoldsRef.current,
      });
    } else {
      controllerRef.current.update({
        map,
        snap,
        selectedKeyIds,
        draggedKeysPreview,
        draggedOriginalKeys: dragContextRef.current?.type === "drag" ? dragContextRef.current.originalKeys : null,
        selectionBox,
        themeColors,
        activeHolds: activeHoldsRef.current,
      });
    }
  });

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const controller = controllerRef.current;
      const canvas = canvasRef.current;
      if (!controller || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const numLanes = 4;
      const laneWidth = rect.width / numLanes;

      const clickedKey = controller.findKeyAt(x, y);
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
            initialMouseTime: controller.yToPos(y),
            initialMouseLane: Math.floor(x / laneWidth),
            originalKeys: keysToDrag,
          };
        }
      } else {
        // No key clicked, start box selection
        if (!isMultiSelect) {
          setSelectedKeyIds(new Set());
        }
        const time = controller.yToPos(y);
        dragContextRef.current = {
          type: "select",
          x1: x,
          t1: time,
        };
        setSelectionBox({ x1: x, t1: time, x2: x, t2: time });
      }
    },
    [map.keys, selectedKeyIds],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const controller = controllerRef.current;
      if (!dragContextRef.current || !controller) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const context = dragContextRef.current;
      if (context.type === "select") {
        setSelectionBox((prev) => {
          if (!prev) return null;
          return { ...prev, x2: x, t2: controller.yToPos(y) };
        });
      } else {
        // type is 'drag'
        const numLanes = 4;
        const laneWidth = rect.width / numLanes;
        const currentTime = controller.yToPos(y);
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
    [map, snap],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const controller = controllerRef.current;
      if (!dragContextRef.current || !controller) return;

      const context = dragContextRef.current;

      if (context.type === "select") {
        if (selectionBox) {
          const { x1, t1, x2, t2 } = selectionBox;
          const y1 = controller.posToY(t1);
          const y2 = controller.posToY(t2);
          const dragDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

          if (dragDistance > 5) {
            const keysInBox = controller.getKeysInBox(x1, t1, x2, t2);
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
    [selectionBox, selectedKeyIds, map, setMap, draggedKeysPreview],
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

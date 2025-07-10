import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppStore, type MapElement, type Beatmap, type SvPattern } from "@/store";
import { findNextSnap, findPreviousSnap, snapLevels, type Snap } from "@/lib/timingPoints";
import { DesignCanvasController } from "@/lib/DesignCanvasController";
import { Input } from "./ui/input";

interface DesignTabProps {
  map: Beatmap;
  setMap: (map: Beatmap) => void;
  getTrueCurrentTime: () => number;
  getCurrentTime: () => number;
  seek: (time: number) => void;
  snap: Snap;
  setSnap: (snap: Snap) => void;
}

export function DesignTab({ map, setMap, getTrueCurrentTime, getCurrentTime, seek, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DesignCanvasController | null>(null);
  const [selectedElements, setSelectedElements] = useState<Set<MapElement>>(new Set());
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const keybinds = useAppStore((s) => s.keybinds);
  const clearListenersRef = useRef<(() => void) | undefined>(undefined);

  const selectedSvNotes = useMemo(() => {
    return Array.from(selectedElements).filter((el) => el.key === "sv");
  }, [selectedElements]);

  useEffect(() => {
    if (selectedSvNotes.length > 0) {
      const firstPatternId = selectedSvNotes[0]?.svPattern;
      const allSame = selectedSvNotes.every((note) => note.svPattern === firstPatternId);

      if (allSame && firstPatternId && map.svPatterns[firstPatternId]) {
        setSelectedPatternId(firstPatternId);
      } else {
        setSelectedPatternId(null);
      }
    } else {
      setSelectedPatternId(null);
    }
  }, [selectedSvNotes, map.svPatterns]);

  const handleCreatePattern = useCallback(() => {
    const newId = crypto.randomUUID();
    const newPattern: SvPattern = { from: 1.0, to: 1.0 };
    setMap({
      ...map,
      svPatterns: {
        ...map.svPatterns,
        [newId]: newPattern,
      },
    });
    setSelectedPatternId(newId);
  }, [map, setMap]);

  const handleUpdatePattern = useCallback(
    (id: string, from: number, to: number) => {
      const newPatterns = { ...map.svPatterns };
      newPatterns[id] = { from: isNaN(from) ? 0 : from, to: isNaN(to) ? 0 : to };
      setMap({ ...map, svPatterns: newPatterns });
    },
    [map, setMap],
  );

  const handleAssignPattern = useCallback(() => {
    if (!selectedPatternId || !controllerRef.current) return;
    controllerRef.current.assignSvPattern(selectedPatternId);
  }, [selectedPatternId]);

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
        keybinds,
        // Callbacks to update component state
        setMap,
        onSelectionChange: (els) => setSelectedElements(new Set(els)),
      });
    } else {
      controllerRef.current.update({
        map,
        snap,
        keybinds,
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

  const handleKeyDown = (e: KeyboardEvent) => {
    controllerRef.current?.handleKeyDown(e);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    controllerRef.current?.handleKeyUp(e);
  };
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const performResize = () => {
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
      if (containerWidth === 0 || containerHeight === 0) return;

      const dpr = window.devicePixelRatio;

      let canvasWidth = containerWidth;
      let canvasHeight = containerHeight;

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

    if (e.deltaY < 0) {
      // Scroll down -> forward in time
      nextTime = findNextSnap(map, getTrueCurrentTime(), snap);
    } else {
      // Scroll up -> backward in time
      nextTime = findPreviousSnap(map, getTrueCurrentTime(), snap);
    }

    if (nextTime !== null) {
      seek(nextTime);
    }
  };

  const clearListeners = () => {
    clearListenersRef.current?.();
    clearListenersRef.current = undefined;
  };

  useEffect(() => {
    return clearListeners;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    controllerRef.current?.handleMouseDown(e.nativeEvent);
    const onMouseMove = (e: MouseEvent) => {
      controllerRef.current?.handleMouseMove(e);
    };
    const onMouseUp = (e: MouseEvent) => {
      clearListeners();
      controllerRef.current?.handleMouseUp(e);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    clearListeners();
    clearListenersRef.current = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

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
        <Button
          onClick={() => controllerRef.current?.flipHorizontal()}
          variant="outline"
          size="sm"
          disabled={selectedElements.size === 0}
        >
          Flip Horizontal
        </Button>
      </div>

      <div className="flex flex-row flex-grow gap-4 min-h-0">
        <aside className="w-0 flex-grow bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-lg">
          {/* Left panel, blank for now */}
        </aside>

        <div
          className="shrink-0 aspect-9/16 relative bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-lg overflow-hidden"
          ref={containerRef}
          onWheel={handleWheel}
        >
          <canvas ref={canvasRef} className="absolute" onMouseDown={handleMouseDown} />
        </div>

        <aside className="w-0 flex-grow bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-lg p-4 flex flex-col gap-4">
          {selectedSvNotes.length > 0 ? (
            <>
              <div className="shrink-0 text-center">
                <h3 className="font-semibold">SV Pattern Editor</h3>
                <p className="text-xs text-[hsl(215,20.2%,65.1%)]">
                  {selectedSvNotes.length} SV note{selectedSvNotes.length > 1 && "s"} selected
                </p>
              </div>

              <Button onClick={handleCreatePattern} size="sm">
                Create New Pattern
              </Button>

              <div className="flex-grow space-y-1 overflow-y-auto pr-2 -mr-2">
                {Object.keys(map.svPatterns).length > 0 ? (
                  Object.keys(map.svPatterns).map((patternId) => (
                    <Button
                      key={patternId}
                      variant={selectedPatternId === patternId ? "secondary" : "ghost"}
                      onClick={() => setSelectedPatternId(patternId)}
                      className="w-full h-auto min-h-8 justify-start text-left"
                      size="sm"
                    >
                      <span className="font-mono text-xs break-all">{patternId}</span>
                    </Button>
                  ))
                ) : (
                  <p className="text-center text-xs text-[hsl(215,20.2%,65.1%)] py-4">No patterns created yet.</p>
                )}
              </div>

              {selectedPatternId && map.svPatterns[selectedPatternId] && (
                <div className="shrink-0 space-y-4 border-t border-[hsl(217.2,32.6%,17.5%)] pt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="from">From</Label>
                    <Input
                      id="from"
                      type="number"
                      value={map.svPatterns[selectedPatternId]!.from}
                      onChange={(e) =>
                        handleUpdatePattern(
                          selectedPatternId,
                          parseFloat(e.target.value),
                          map.svPatterns[selectedPatternId]!.to,
                        )
                      }
                      step="0.1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="to">To</Label>
                    <Input
                      id="to"
                      type="number"
                      value={map.svPatterns[selectedPatternId]!.to}
                      onChange={(e) =>
                        handleUpdatePattern(
                          selectedPatternId,
                          map.svPatterns[selectedPatternId]!.from,
                          parseFloat(e.target.value),
                        )
                      }
                      step="0.1"
                    />
                  </div>
                  <Button onClick={handleAssignPattern} className="w-full">
                    Assign to Selection
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-sm text-[hsl(215,20.2%,65.1%)] m-auto">
              Select one or more SV notes to configure patterns.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

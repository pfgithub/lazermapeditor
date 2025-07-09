import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppStore, type Note, type Beatmap } from "@/store";
import { findNextSnap, findPreviousSnap, snapLevels, type Snap } from "@/lib/timingPoints";
import { DesignCanvasController } from "@/lib/DesignCanvasController";

interface DesignTabProps {
  map: Beatmap;
  setMap: (map: Beatmap) => void;
  getCurrentTime: () => number;
  seek: (time: number) => void;
  snap: Snap;
  setSnap: (snap: Snap) => void;
}

export function DesignTab({ map, setMap, getCurrentTime, seek, snap, setSnap }: DesignTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DesignCanvasController | null>(null);
  const [selectionCount, setSelectionCount] = useState(0);
  const keybinds = useAppStore((s) => s.keybinds);

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
        onSelectionChange: setSelectionCount,
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

    if (e.deltaY < 0) {
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
        <Button
          onClick={() => controllerRef.current?.flipHorizontal()}
          variant="outline"
          size="sm"
          disabled={selectionCount === 0}
        >
          Flip Horizontal
        </Button>
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

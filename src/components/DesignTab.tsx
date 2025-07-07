import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Map, Song } from "@/store";

interface DesignTabProps {
  map: Map;
  song: Song | null;
}

export function DesignTab({ map, song }: DesignTabProps) {
  const [snap, setSnap] = useState<number>(4);
  const snapLevels = [1, 2, 4, 8, 16];

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();

  const PIXELS_PER_SECOND_PLAY = 800; // Scroll speed during playback
  const JUDGEMENT_LINE_Y_PLAYBACK = 50; // Y position of judgement line from bottom during playback

  // Gets the active timing segment for a given time.
  // Returns a default if no timing points are set.
  const getActiveTiming = (time: number) => {
    if (map.timing.length === 0) {
      return { id: "default", bpm: 120, startTime: 0 };
    }
    return map.timing.findLast((s) => s.startTime <= time) ?? map.timing[0];
  };

  // Calculates the time of the next or previous snap point.
  const getSnapTime = (time: number, direction: "next" | "prev", division: number = snap) => {
    const activeSegment = getActiveTiming(time);
    if (activeSegment.bpm <= 0) return time + (direction === "next" ? 1 : -1);

    const beatDuration = 60 / activeSegment.bpm;
    const snapDuration = beatDuration * (4 / division);

    // This logic correctly calculates the snap based on the active segment's grid.
    const relativeTime = time - activeSegment.startTime;
    const numSnaps = relativeTime / snapDuration;

    const targetSnapIndex = direction === "next" ? Math.floor(numSnaps) + 1 : Math.ceil(numSnaps) - 1;

    return activeSegment.startTime + targetSnapIndex * snapDuration;
  };

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

    const posToY = (lineTime: number) => {
      return height - JUDGEMENT_LINE_Y_PLAYBACK - (lineTime - time) * PIXELS_PER_SECOND_PLAY;
    };

    if (map.timing.length === 0 && getActiveTiming(time).bpm <= 0) return; // Don't draw lines if no timing info

    // Helper to draw lines in one direction (past or future)
    const drawLines = (startAt: number, direction: "next" | "prev") => {
      let currentLineTime = startAt;
      for (let i = 0; i < 200; i++) {
        // Limit to 200 lines to prevent infinite loops
        const y = posToY(currentLineTime);

        // Stop drawing if lines are way off-screen
        if (y < -20 || y > height + 20) {
          if (i === 0) {
            currentLineTime = getSnapTime(currentLineTime, direction, 16); // Ensure we eventually get on screen
            continue;
          } else {
            break;
          }
        }

        const { bpm, startTime } = getActiveTiming(currentLineTime);
        if (bpm > 0) {
          const beatDuration = 60 / bpm;
          const relativeTime = currentLineTime - startTime;

          const isNth = (n: number) => {
            const divisionDuration = (beatDuration * 4) / n;
            if (divisionDuration < 0.001) return false;
            const numDivisions = relativeTime / divisionDuration;
            return Math.abs(numDivisions - Math.round(numDivisions)) < 0.001;
          };

          let strokeStyle = "";
          let lineWidth = 1;

          if (isNth(1)) {
            strokeStyle = "black";
            lineWidth = 1.5;
          } else if (isNth(2)) {
            strokeStyle = "red";
            lineWidth = 1.25;
          } else if (isNth(4)) {
            strokeStyle = "lightblue";
            lineWidth = 1;
          } else if (isNth(8)) {
            strokeStyle = "yellow";
            lineWidth = 0.75;
          } else if (isNth(16)) {
            strokeStyle = "orange";
            lineWidth = 0.5;
          }

          if (strokeStyle) {
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = strokeStyle;

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        currentLineTime = getSnapTime(currentLineTime, direction, 16);
      }
    };

    drawLines(getSnapTime(time - 0.001, "next", 16), "next");
    drawLines(time, "prev"); // Start from current time to draw past lines

    // --- Draw Judgement Line ---
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 3;
    const judgementY = height - JUDGEMENT_LINE_Y_PLAYBACK;
    ctx.beginPath();
    ctx.moveTo(0, judgementY);
    ctx.lineTo(width, judgementY);
    ctx.stroke();

    ctx.restore();
  };

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    const loop = () => {
      const time = audioRef.current?.currentTime ?? currentTime;
      if (isPlaying) {
        setCurrentTime(time);
      }
      draw(time);
      animationFrameId.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isPlaying, map, currentTime]); // Re-run if any of these change

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
      draw(audioRef.current?.currentTime ?? currentTime);
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
  }, []);

  // Handle scroll-to-snap
  const handleWheel = (e: React.WheelEvent) => {
    if (isPlaying) return;
    e.preventDefault();
    const newTime = getSnapTime(currentTime, e.deltaY > 0 ? "next" : "prev");
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  // Sync state with audio element when seeking manually
  const handleTimeUpdate = () => {
    if (audioRef.current && !isPlaying) {
      setCurrentTime(audioRef.current.currentTime);
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

      <div className="flex-grow relative bg-card border rounded-lg overflow-hidden" ref={containerRef} onWheel={handleWheel}>
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </div>

      <div className="shrink-0">
        {song?.url ? (
          <audio
            ref={audioRef}
            key={song.url}
            src={song.url}
            controls
            className="w-full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onSeeked={handleTimeUpdate}
          />
        ) : (
          <div className="text-center text-muted-foreground p-4 bg-muted rounded-md h-[54px] flex items-center justify-center">
            Please select a song in the Metadata tab.
          </div>
        )}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./index.css";
import { useEffect, useRef, useState } from "react";
import { cn } from "./lib/utils";

// Types
type TimingSegment = {
  id: string;
  startTime: number;
  bpm: number;
};

type Map = {
  timing: TimingSegment[]; // sorted by start time
};

type Song = {
  url: string;
  name: string;
};

function MetadataTab({ song, setSong }: { song: Song | null; setSong: (song: Song | null) => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  const handleSongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke old URL to prevent memory leaks
      if (song?.url) {
        URL.revokeObjectURL(song.url);
      }
      setSong({
        url: URL.createObjectURL(file),
        name: file.name,
      });
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <form className="grid gap-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="map-name" className="text-right">
            Map Name
          </Label>
          <Input id="map-name" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="artist" className="text-right">
            Artist
          </Label>
          <Input id="artist" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="map-author" className="text-right">
            Map Author
          </Label>
          <Input id="map-author" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="difficulty-name" className="text-right">
            Difficulty Name
          </Label>
          <Input id="difficulty-name" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Image</Label>
          <div className="col-span-3">
            <input type="file" accept="image/*" ref={imageInputRef} className="hidden" />
            <Button type="button" onClick={() => imageInputRef.current?.click()} variant="outline">
              Select Image
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Song</Label>
          <div className="col-span-3 flex items-center gap-4">
            <input type="file" accept="audio/*" ref={songInputRef} className="hidden" onChange={handleSongChange} />
            <Button type="button" onClick={() => songInputRef.current?.click()} variant="outline">
              Select Song
            </Button>
            <span className="text-sm text-muted-foreground truncate">{song?.name ?? "No song selected."}</span>
          </div>
        </div>
      </form>
    </div>
  );
}

function TimingTab({ map, setMap, songUrl }: { map: Map; setMap: (map: Map) => void; songUrl: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const selectedSegment = map.timing.find((s) => s.id === selectedSegmentId);

  const handleAddSegment = () => {
    const currentTime = audioRef.current?.currentTime ?? 0;
    const newSegment: TimingSegment = {
      id: crypto.randomUUID(),
      startTime: currentTime,
      bpm: 120,
    };
    const newTiming = [...map.timing, newSegment].sort((a, b) => a.startTime - b.startTime);
    setMap({ ...map, timing: newTiming });
    setSelectedSegmentId(newSegment.id);
  };

  const handleUpdateSegment = (field: "startTime" | "bpm", value: string) => {
    if (!selectedSegment) return;
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== "") return;

    const updatedSegment = { ...selectedSegment, [field]: isNaN(numericValue) ? 0 : numericValue };

    let newTiming = map.timing.map((s) => (s.id === selectedSegmentId ? updatedSegment : s));

    if (field === "startTime") {
      newTiming.sort((a, b) => a.startTime - b.startTime);
    }

    setMap({ ...map, timing: newTiming });
  };

  const handleDeleteSegment = () => {
    if (!selectedSegmentId) return;
    const newTiming = map.timing.filter((s) => s.id !== selectedSegmentId);
    setMap({ ...map, timing: newTiming });
    setSelectedSegmentId(null);
  };

  return (
    <div className="flex flex-row h-full">
      <div className="flex-grow flex flex-col gap-4 p-4">
        {/* Top section: Player and Add button */}
        <div className="flex flex-col gap-2">
          {songUrl ? (
            <audio ref={audioRef} key={songUrl} src={songUrl} controls className="w-full" />
          ) : (
            <div className="text-center text-muted-foreground p-4 bg-muted rounded-md h-[54px] flex items-center justify-center">
              Please select a song in the Metadata tab.
            </div>
          )}
          <Button onClick={handleAddSegment} disabled={!songUrl}>
            Add Timing Segment at Current Time
          </Button>
        </div>

        {/* List of segments */}
        <div className="flex-grow overflow-y-auto border rounded-md bg-background">
          <ul className="p-1">
            {map.timing.length > 0 ? (
              map.timing.map((segment) => (
                <li
                  key={segment.id}
                  onClick={() => setSelectedSegmentId(segment.id)}
                  className={cn(
                    "p-2 cursor-pointer hover:bg-accent rounded-md text-sm flex justify-between items-center",
                    selectedSegmentId === segment.id && "bg-accent",
                  )}
                >
                  <span>
                    Time: <strong>{segment.startTime.toFixed(3)}s</strong>
                  </span>
                  <span>
                    BPM: <strong>{segment.bpm}</strong>
                  </span>
                </li>
              ))
            ) : (
              <div className="text-center text-muted-foreground p-4">No timing segments added.</div>
            )}
          </ul>
        </div>
      </div>

      {/* Right sidebar: Editor */}
      {selectedSegment && (
        <aside className="w-80 border-l bg-card p-4 flex flex-col gap-4 shrink-0">
          <h2 className="text-lg font-semibold">Edit Segment</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="startTime">Start Time (s)</Label>
            <Input
              id="startTime"
              type="number"
              value={selectedSegment.startTime}
              onChange={(e) => handleUpdateSegment("startTime", e.target.value)}
              step="0.001"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bpm">BPM</Label>
            <Input
              id="bpm"
              type="number"
              value={selectedSegment.bpm}
              onChange={(e) => handleUpdateSegment("bpm", e.target.value)}
            />
          </div>
          <Button onClick={handleDeleteSegment} variant="destructive" className="mt-auto">
            Delete Segment
          </Button>
        </aside>
      )}
    </div>
  );
}

function DesignTab({ map, song }: { map: Map; song: Song | null }) {
  const [snap, setSnap] = useState<number>(4);
  const snapLevels = [1, 2, 4, 8, 16];

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();

  const PIXELS_PER_SECOND_EDIT = 400; // Vertical spacing of lines in editor mode
  const PIXELS_PER_SECOND_PLAY = 800; // Scroll speed during playback
  const JUDGEMENT_LINE_Y_EDIT = 300; // Y position of judgement line in editor mode
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
      if (isPlaying) {
        return height - JUDGEMENT_LINE_Y_PLAYBACK - (lineTime - time) * PIXELS_PER_SECOND_PLAY;
      } else {
        return JUDGEMENT_LINE_Y_EDIT - (lineTime - time) * PIXELS_PER_SECOND_EDIT;
      }
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
    const judgementY = isPlaying ? height - JUDGEMENT_LINE_Y_PLAYBACK : JUDGEMENT_LINE_Y_EDIT;
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

export function App() {
  const [map, setMap] = useState<Map>({ timing: [] });
  const [song, setSong] = useState<Song | null>(null);

  // Clean up song object URL on unmount
  useEffect(() => {
    return () => {
      if (song?.url) {
        URL.revokeObjectURL(song.url);
      }
    };
  }, [song]);

  return (
    <main className="w-screen h-screen flex flex-col bg-background text-foreground">
      <Tabs defaultValue="metadata" className="w-full h-full flex flex-col p-2 gap-2">
        <TabsList className="mx-auto shrink-0">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="flex-grow min-h-0 bg-card rounded-lg border">
          <MetadataTab song={song} setSong={setSong} />
        </TabsContent>
        <TabsContent value="design" className="flex-grow min-h-0">
          <DesignTab map={map} song={song} />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 bg-card rounded-lg border">
          <TimingTab map={map} setMap={setMap} songUrl={song?.url ?? null} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default App;

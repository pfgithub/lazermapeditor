
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

function CanvasTab() {
  return (
    <div className="w-full h-full">
      <canvas className="w-full h-full bg-card border rounded-lg"></canvas>
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
          <CanvasTab />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 bg-card rounded-lg border">
          <TimingTab map={map} setMap={setMap} songUrl={song?.url ?? null} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default App;
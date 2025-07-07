import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Key, Map, TimingSegment } from "@/store";
import { findNearestSnap } from "@/lib/timingPoints";

interface TimingTabProps {
  map: Map;
  setMap: (map: Map) => void;
  songUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export function TimingTab({ map, setMap, songUrl, audioRef }: TimingTabProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const selectedSegment = map.timing.find((s) => s.id === selectedSegmentId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: { [key: string]: 0 | 1 | 2 | 3 } = {
        d: 0,
        f: 1,
        j: 2,
        k: 3,
      };

      const keyIndex = keyMap[e.key.toLowerCase()];
      if (keyIndex === undefined) return;

      if (!audioRef.current) return;
      // Prevent adding notes if user is typing in an input
      if (document.activeElement?.tagName === "INPUT") return;

      const currentTime = audioRef.current.currentTime;
      const nearestTime = findNearestSnap(map, currentTime, 16);

      if (nearestTime === null) return;

      e.preventDefault();

      const newKey: Key = { time: nearestTime, key: keyIndex };

      // Avoid adding duplicate keys at the same time and column
      if (map.keys.some((k) => k.time === newKey.time && k.key === newKey.key)) {
        return;
      }

      const newKeys = [...map.keys, newKey].sort((a, b) => a.time - b.time);
      setMap({ ...map, keys: newKeys });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [map, setMap, audioRef]);

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
          {!songUrl && (
            <div className="text-center text-muted-foreground p-4 bg-muted rounded-md h-[54px] flex items-center justify-center">
              Please select a song in the Metadata tab to enable timing controls.
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

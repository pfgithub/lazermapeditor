import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Map, TimingSegment } from "@/store";
import { useAppStore } from "@/store";

interface TimingTabProps {
  map: Map;
  setMap: (map: Map) => void;
}

export function TimingTab({ map, setMap }: TimingTabProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const { currentTime, song } = useAppStore();

  const selectedSegment = map.timing.find((s) => s.id === selectedSegmentId);

  const handleAddSegment = () => {
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
        {/* Top section: Add button */}
        <div className="flex flex-col gap-2">
          {song ? (
            <Button onClick={handleAddSegment}>Add Timing Segment at Current Time ({currentTime.toFixed(3)}s)</Button>
          ) : (
            <div className="text-center text-muted-foreground p-4 bg-muted rounded-md h-[40px] flex items-center justify-center">
              Please select a song in the Metadata tab.
            </div>
          )}
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

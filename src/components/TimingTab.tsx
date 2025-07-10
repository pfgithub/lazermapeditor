import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Beatmap, SvPattern, TimingSegment } from "@/store";

interface TimingTabProps {
  map: Beatmap;
  setMap: (map: Beatmap) => void;
  songUrl: string | null;
  getCurrentTime: () => number;
}

type Selection = { type: "timing"; id: string } | { type: "sv"; id: string };

export function TimingTab({ map, setMap, songUrl, getCurrentTime }: TimingTabProps) {
  const [selection, setSelection] = useState<Selection | null>(null);

  const selectedSegment = selection?.type === "timing" ? map.timing.find((s) => s.id === selection.id) : null;
  const selectedSvPatternId = selection?.type === "sv" ? selection.id : null;
  const selectedSvPattern = selectedSvPatternId ? map.svPatterns[selectedSvPatternId] : null;

  const handleAddSegment = () => {
    const newSegment: TimingSegment = {
      id: crypto.randomUUID(),
      startTime: getCurrentTime(),
      bpm: 120,
    };
    const newTiming = [...map.timing, newSegment].sort((a, b) => a.startTime - b.startTime);
    setMap({ ...map, timing: newTiming });
    setSelection({ type: "timing", id: newSegment.id });
  };

  const handleUpdateSegment = (field: "startTime" | "bpm", value: string) => {
    if (!selectedSegment) return;
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== "") return;

    const updatedSegment = { ...selectedSegment, [field]: isNaN(numericValue) ? 0 : numericValue };

    let newTiming = map.timing.map((s) => (s.id === selection?.id ? updatedSegment : s));

    if (field === "startTime") {
      newTiming.sort((a, b) => a.startTime - b.startTime);
    }

    setMap({ ...map, timing: newTiming });
  };

  const handleDeleteSegment = () => {
    if (selection?.type !== "timing") return;
    const newTiming = map.timing.filter((s) => s.id !== selection.id);
    setMap({ ...map, timing: newTiming });
    setSelection(null);
  };

  const handleAddSvPattern = () => {
    const existingIds = Object.keys(map.svPatterns).map(Number).filter(isFinite);
    const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;
    const newPattern: SvPattern = { from: 0.5, to: 0.5 }; // Linear
    setMap({
      ...map,
      svPatterns: { ...map.svPatterns, [newId]: newPattern },
    });
    setSelection({ type: "sv", id: String(newId) });
  };

  const handleUpdateSvPattern = (field: keyof SvPattern, value: string) => {
    if (!selectedSvPattern || !selectedSvPatternId) return;
    const numericValue = Math.max(0, Math.min(1, parseFloat(value) || 0)); // clamp between 0 and 1

    const updatedPattern = { ...selectedSvPattern, [field]: numericValue };
    setMap({
      ...map,
      svPatterns: { ...map.svPatterns, [selectedSvPatternId]: updatedPattern },
    });
  };

  const handleDeleteSvPattern = () => {
    if (!selectedSvPatternId) return;
    const newPatterns = { ...map.svPatterns };
    delete newPatterns[selectedSvPatternId];
    setMap({ ...map, svPatterns: newPatterns });
    setSelection(null);
  };

  const isSvPatternInUse = (patternId: string) => {
    return map.svs.some((sv) => sv.pattern === patternId);
  };

  return (
    <div className="flex flex-row h-full bg-[hsl(224,71%,4%)] rounded-lg border border-[hsl(217.2,32.6%,17.5%)] overflow-hidden">
      <div className="flex-grow flex flex-col gap-4 p-4">
        {!songUrl && (
          <div className="text-center text-[hsl(215,20.2%,65.1%)] p-4 bg-[hsl(217.2,32.6%,17.5%)] rounded-md h-[54px] flex items-center justify-center">
            Please select a song in the Metadata tab to enable timing controls.
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button onClick={handleAddSegment} disabled={!songUrl}>
            Add Timing Segment at Current Time
          </Button>
          <Button onClick={handleAddSvPattern} disabled={!songUrl}>
            Add New SV Pattern
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto border border-[hsl(217.2,32.6%,17.5%)] rounded-md bg-[hsl(222.2,84%,4.9%)] p-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(215,20.2%,65.1%)] px-2 mb-1">Timing Segments</h3>
            <ul className="space-y-1">
              {map.timing.length > 0 ? (
                map.timing.map((segment) => (
                  <li
                    key={segment.id}
                    onClick={() => setSelection({ type: "timing", id: segment.id })}
                    className={cn(
                      "p-2 cursor-pointer hover:bg-[hsl(217.2,32.6%,17.5%)] rounded-md text-sm flex justify-between items-center",
                      selection?.type === "timing" && selection.id === segment.id && "bg-[hsl(217.2,32.6%,17.5%)]",
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
                <div className="text-center text-xs text-[hsl(215,20.2%,65.1%)] p-2">No timing segments added.</div>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[hsl(215,20.2%,65.1%)] px-2 mb-1">SV Patterns</h3>
            <ul className="space-y-1">
              {Object.keys(map.svPatterns).length > 0 ? (
                Object.entries(map.svPatterns).map(([id, pattern]) => (
                  <li
                    key={id}
                    onClick={() => setSelection({ type: "sv", id })}
                    className={cn(
                      "p-2 cursor-pointer hover:bg-[hsl(217.2,32.6%,17.5%)] rounded-md text-sm flex justify-between items-center",
                      selection?.type === "sv" && selection.id === id && "bg-[hsl(217.2,32.6%,17.5%)]",
                    )}
                  >
                    <span>
                      Pattern <strong>#{id}</strong>
                    </span>
                    <span className="font-mono text-xs">
                      {pattern.from.toFixed(2)} &#x2192; {pattern.to.toFixed(2)}
                    </span>
                  </li>
                ))
              ) : (
                <div className="text-center text-xs text-[hsl(215,20.2%,65.1%)] p-2">No SV patterns created.</div>
              )}
            </ul>
          </div>
        </div>
      </div>

      <aside className="w-80 border-l border-l-[hsl(217.2,32.6%,17.5%)] bg-[hsl(224,71%,4%)] p-4 flex flex-col gap-4 shrink-0">
        {selectedSegment && (
          <>
            <h2 className="text-lg font-semibold">Edit Timing Segment</h2>
            <div className="grid gap-1.5">
              <Label htmlFor="startTime">Start Time (s)</Label>
              <Input id="startTime" type="number" value={selectedSegment.startTime} onChange={(e) => handleUpdateSegment("startTime", e.target.value)} step="0.001" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bpm">BPM</Label>
              <Input id="bpm" type="number" value={selectedSegment.bpm} onChange={(e) => handleUpdateSegment("bpm", e.target.value)} />
            </div>
            <Button onClick={handleDeleteSegment} variant="destructive" className="mt-auto">
              Delete Segment
            </Button>
          </>
        )}
        {selectedSvPattern && selectedSvPatternId && (
          <>
            <h2 className="text-lg font-semibold">Edit SV Pattern #{selectedSvPatternId}</h2>
            <div className="grid gap-1.5">
              <Label htmlFor="svFrom">"From" point (time %)</Label>
              <Input id="svFrom" type="number" value={selectedSvPattern.from} onChange={(e) => handleUpdateSvPattern("from", e.target.value)} step="0.01" min="0" max="1" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svTo">"To" point (progress %)</Label>
              <Input id="svTo" type="number" value={selectedSvPattern.to} onChange={(e) => handleUpdateSvPattern("to", e.target.value)} step="0.01" min="0" max="1" />
            </div>
            <p className="text-xs text-[hsl(215,20.2%,65.1%)]">Defines a piecewise linear speed curve. Values are 0-1.</p>
            <Button onClick={handleDeleteSvPattern} variant="destructive" className="mt-auto" disabled={isSvPatternInUse(selectedSvPatternId)}>
              Delete Pattern
            </Button>
            {isSvPatternInUse(selectedSvPatternId) && <p className="text-xs text-center text-amber-400">This pattern is currently in use.</p>}
          </>
        )}
        {!selection && (
          <div className="m-auto text-center text-sm text-[hsl(215,20.2%,65.1%)]">
            <p>Select an item from the list to edit its properties.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

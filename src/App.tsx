import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignTab } from "@/components/DesignTab";
import { MetadataTab } from "@/components/MetadataTab";
import { TimingTab } from "@/components/TimingTab";
import "./index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "./store";
import { WaveformDisplay } from "./components/WaveformDisplay";
import type { Snap } from "./lib/timingPoints";

// Types are now in src/store.ts

export function App() {
  const { map, song, setMap, setSongFile, loadFromDb, isInitialized } = useAppStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState("metadata");
  const [designSnap, setDesignSnap] = useState<Snap>(4);

  const snapForWaveform = useMemo((): Snap => {
    if (activeTab === "timing") return 16;
    if (activeTab === "design") return designSnap;
    return 4; // Default snap for other tabs
  }, [activeTab, designSnap]);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  // Global cleanup for blob URL on app close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentSong = useAppStore.getState().song;
      if (currentSong?.url) {
        URL.revokeObjectURL(currentSong.url);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Animation loop for current time
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    const loop = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Sync state with audio element when seeking manually
  const handleTimeUpdate = () => {
    if (audioRef.current && !isPlaying) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  if (!isInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background text-foreground">
        <p>Loading project from database...</p>
      </div>
    );
  }

  return (
    <main className="w-screen h-screen flex flex-col bg-background text-foreground p-2 gap-2">
      <Tabs
        defaultValue="metadata"
        className="w-full flex-grow flex flex-col gap-2 min-h-0"
        onValueChange={setActiveTab}
      >
        <TabsList className="mx-auto shrink-0">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="flex-grow min-h-0 bg-card rounded-lg border">
          <MetadataTab song={song} setSong={setSongFile} />
        </TabsContent>
        <TabsContent value="design" className="flex-grow min-h-0">
          <DesignTab map={map} setMap={setMap} audioRef={audioRef} snap={designSnap} setSnap={setDesignSnap} />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 bg-card rounded-lg border">
          <TimingTab map={map} setMap={setMap} audioRef={audioRef} songUrl={song?.url ?? null} />
        </TabsContent>
      </Tabs>

      <footer className="shrink-0 flex flex-col gap-2">
        <div className="h-24">
          <WaveformDisplay
            songUrl={song?.url}
            currentTime={currentTime}
            map={map}
            snap={snapForWaveform}
          />
        </div>
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
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <div className="text-center text-muted-foreground p-4 bg-muted rounded-md h-[54px] flex items-center justify-center">
            Please select a song in the Metadata tab.
          </div>
        )}
      </footer>
    </main>
  );
}

export default App;

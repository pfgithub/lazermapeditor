import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignTab } from "@/components/DesignTab";
import { MetadataTab } from "@/components/MetadataTab";
import { TimingTab } from "@/components/TimingTab";
import "./index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "./store";
import { WaveformDisplay } from "./components/WaveformDisplay";
import type { Snap } from "./lib/timingPoints";
import { AudioController } from "./lib/audio";
import { Button } from "./components/ui/button";
import { Pause, Play } from "lucide-react";
import { allowKeyEvent } from "./lib/utils";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function App() {
  const { map, song, setMap, setSongFile, loadFromDb, isInitialized } = useAppStore();
  const audioControllerRef = useRef<AudioController | null>(null);
  const spaceDownTimeRef = useRef<number | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isSongLoading, setIsSongLoading] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState("metadata");
  const [designSnap, setDesignSnap] = useState<Snap>(4);
  // precise time must not be stored in state to prevent excessive rerenders
  const [currentTimeRounded, setCurrentTimeRounded] = useState(0);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  // Initialize AudioController
  useEffect(() => {
    const controller = new AudioController();
    audioControllerRef.current = controller;

    controller.onPlay = () => setIsPlaying(true);
    controller.onPause = () => setIsPlaying(false);
    controller.onBufferLoad = (buffer) => {
      setAudioBuffer(buffer);
      setDuration(buffer.duration);
    };

    return () => {
      controller.cleanup();
    };
  }, []);

  // Time update loop
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      const time = audioControllerRef.current?.getCurrentTime() ?? 0;
      setCurrentTimeRounded(Math.round(time));
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Load song when URL changes
  useEffect(() => {
    const controller = audioControllerRef.current;
    if (song?.url && controller) {
      setIsSongLoading(true);
      setIsPlaying(false);
      setDuration(0);
      setAudioBuffer(null);
      controller
        .load(song.url)
        .catch((err) => {
          console.error("Failed to load audio", err);
          // TODO: show an error to the user
        })
        .finally(() => {
          setIsSongLoading(false);
        });
    } else {
      setAudioBuffer(null);
      setDuration(0);
    }
  }, [song?.url]);

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

  // Global keybinding for hold-space-to-play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!allowKeyEvent(e)) return;

      // Prevent repeated plays when holding space
      if (e.repeat) return;

      e.preventDefault();
      const controller = audioControllerRef.current;
      // If there's no controller or audio is already playing, do nothing.
      if (!controller || controller.getIsPlaying()) {
        return;
      }

      spaceDownTimeRef.current = controller.getCurrentTime();
      controller.play();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!allowKeyEvent(e)) return;

      // If we weren't in a "hold-to-play" state, do nothing.
      if (spaceDownTimeRef.current === null) {
        return;
      }

      e.preventDefault();
      const controller = audioControllerRef.current;
      if (!controller) return;

      controller.pause();
      controller.seek(spaceDownTimeRef.current);
      spaceDownTimeRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      // Cleanup in case the component unmounts while space is held down
      const controller = audioControllerRef.current;
      if (controller && spaceDownTimeRef.current !== null) {
        controller.pause();
        controller.seek(spaceDownTimeRef.current);
        spaceDownTimeRef.current = null;
      }
    };
  }, []);

  const getCurrentTime = () => audioControllerRef.current?.getCurrentTime() ?? 0;

  const handleSeek = (time: number) => {
    audioControllerRef.current?.seek(time);
  };

  if (!isInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[hsl(222.2,84%,4.9%)] text-[hsl(210,40%,98%)]">
        <p>Loading project from database...</p>
      </div>
    );
  }

  return (
    <main className="w-screen h-screen flex flex-col bg-[hsl(222.2,84%,4.9%)] text-[hsl(210,40%,98%)] p-4 gap-4">
      <Tabs
        defaultValue="metadata"
        className="w-full flex-grow flex flex-col gap-4 min-h-0"
        onValueChange={setActiveTab}
      >
        <TabsList className="mx-auto shrink-0">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="flex-grow min-h-0 m-0">
          <MetadataTab map={map} setMap={setMap} song={song} setSong={setSongFile} />
        </TabsContent>
        <TabsContent value="design" className="flex-grow min-h-0 m-0">
          <DesignTab
            map={map}
            setMap={setMap}
            getCurrentTime={getCurrentTime}
            seek={handleSeek}
            snap={designSnap}
            setSnap={setDesignSnap}
          />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 m-0">
          <TimingTab map={map} setMap={setMap} getCurrentTime={getCurrentTime} songUrl={song?.url ?? null} />
        </TabsContent>
      </Tabs>

      <footer className="shrink-0 flex flex-col gap-4">
        <div className="h-24">
          <WaveformDisplay
            audioBuffer={audioBuffer}
            isSongLoading={isSongLoading}
            getCurrentTime={getCurrentTime}
            map={map}
            snap={designSnap}
          />
        </div>
        {song?.url ? (
          <div className="flex items-center gap-4 bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] p-3 rounded-lg h-[60px]">
            <Button
              onClick={() => {
                const controller = audioControllerRef.current;
                if (controller) {
                  controller.getIsPlaying() ? controller.pause() : controller.play();
                }
              }}
              size="icon"
              variant="ghost"
              className="h-10 w-10"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <div className="text-sm font-mono w-28 text-center text-[hsl(215,20.2%,65.1%)]">
              {formatTime(currentTimeRounded)} / {formatTime(duration)}
            </div>
            <input
              type="range"
              min="0"
              max={duration || 1}
              value={currentTimeRounded}
              step="0.01"
              className="w-full h-2 bg-[hsl(217.2,32.6%,17.5%)] rounded-lg appearance-none cursor-pointer"
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
            />
          </div>
        ) : (
          <div className="text-center text-[hsl(215,20.2%,65.1%)] bg-[hsl(224,71%,4%)] border border-[hsl(217.2,32.6%,17.5%)] p-3 rounded-lg h-[60px] flex items-center justify-center">
            Please select a song in the Metadata tab.
          </div>
        )}
      </footer>
    </main>
  );
}

export default App;

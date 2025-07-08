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

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function App() {
  const { map, song, setMap, setSongFile, loadFromDb, isInitialized } = useAppStore();
  const audioControllerRef = useRef<AudioController | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    if (isPlaying) {
      const loop = () => {
        const time = audioControllerRef.current?.getCurrentTime() ?? 0;
        setCurrentTime(time);
        animationFrameId = requestAnimationFrame(loop);
      };
      loop();
    }
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Load song when URL changes
  useEffect(() => {
    const controller = audioControllerRef.current;
    if (song?.url && controller) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setAudioBuffer(null);
      controller.load(song.url).catch((err) => {
        console.error("Failed to load audio", err);
        // TODO: show an error to the user
      });
    } else {
      setAudioBuffer(null);
      setDuration(0);
      setCurrentTime(0);
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

  // Global keybinding for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      // Don't trigger when a text input, button, or the audio player is focused.
      const activeEl = document.activeElement;
      if (
        activeEl &&
        ((activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "text") ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "BUTTON")
      ) {
        return;
      }

      // Prevent repeated toggling when holding space
      if (e.repeat) return;

      e.preventDefault();
      const controller = audioControllerRef.current;
      if (!controller) return;

      if (controller.getIsPlaying()) {
        controller.pause();
      } else {
        controller.play();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSeek = (time: number) => {
    audioControllerRef.current?.seek(time);
    setCurrentTime(time);
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
          <DesignTab
            map={map}
            setMap={setMap}
            currentTime={currentTime}
            seek={handleSeek}
            snap={designSnap}
            setSnap={setDesignSnap}
          />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 bg-card rounded-lg border">
          <TimingTab map={map} setMap={setMap} currentTime={currentTime} songUrl={song?.url ?? null} />
        </TabsContent>
      </Tabs>

      <footer className="shrink-0 flex flex-col gap-2">
        <div className="h-24">
          <WaveformDisplay
            audioBuffer={audioBuffer}
            currentTime={currentTime}
            map={map}
            snap={snapForWaveform}
          />
        </div>
        {song?.url ? (
          <div className="flex items-center gap-4 bg-muted/80 p-2 rounded-md h-[54px]">
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
            <div className="text-sm font-mono w-28 text-center">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <input
              type="range"
              min="0"
              max={duration || 1}
              value={currentTime}
              step="0.01"
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
            />
          </div>
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

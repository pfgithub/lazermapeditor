import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignTab } from "@/components/DesignTab";
import { MetadataTab } from "@/components/MetadataTab";
import { TimingTab } from "@/components/TimingTab";
import "./index.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAppStore } from "./store";
import { WaveformDisplay } from "./components/WaveformDisplay";
import type { Snap } from "./lib/timingPoints";

// Types are now in src/store.ts

export function App() {
  const { map, song, setMap, setSongFile, loadFromDb, isInitialized } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState("metadata");
  const [designSnap, setDesignSnap] = useState<Snap>(4);

  // Web Audio API State
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const pausedAtRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  // A ref to track isPlaying state in callbacks without re-triggering them
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const snapForWaveform = useMemo((): Snap => {
    if (activeTab === "timing") return 16;
    if (activeTab === "design") return designSnap;
    return 4; // Default snap for other tabs
  }, [activeTab, designSnap]);

  // Initial DB load
  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  // Initialize and cleanup AudioContext and global listeners
  useEffect(() => {
    // We create the audio context once.
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const handleBeforeUnload = () => {
      const currentSong = useAppStore.getState().song;
      if (currentSong?.url) {
        URL.revokeObjectURL(currentSong.url);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      audioContextRef.current?.close().catch((e) => console.error("Error closing AudioContext", e));
    };
  }, []);

  // Load audio data into an AudioBuffer when song changes
  useEffect(() => {
    if (!song?.url) {
      setAudioBuffer(null);
      return;
    }

    // Stop any existing playback and reset state
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    pausedAtRef.current = 0;
    startedAtRef.current = 0;

    const audioContext = audioContextRef.current!;
    let isActive = true; // prevent state updates on unmounted component

    fetch(song.url)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((decodedData) => {
        if (isActive) {
          setAudioBuffer(decodedData);
        }
      })
      .catch((err) => {
        console.error("Error decoding audio data:", err);
        if (isActive) setAudioBuffer(null);
      });

    return () => {
      isActive = false;
    };
  }, [song?.url]);

  const play = useCallback(() => {
    if (!audioBuffer || !audioContextRef.current || isPlayingRef.current) return;
    const audioContext = audioContextRef.current;

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    const offset = pausedAtRef.current;
    source.start(0, offset);

    startedAtRef.current = audioContext.currentTime - offset;
    sourceNodeRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      // onended is called on stop() and when the track finishes.
      // We only want to reset if the track finished playing on its own.
      if (isPlayingRef.current) {
        setIsPlaying(false);
        pausedAtRef.current = 0;
        setCurrentTime(0);
      }
    };
  }, [audioBuffer]);

  const pause = useCallback(() => {
    if (!sourceNodeRef.current || !audioContextRef.current || !isPlayingRef.current) return;
    const audioContext = audioContextRef.current;

    // Remove the onended handler to prevent it from firing on a manual stop.
    sourceNodeRef.current.onended = null;
    sourceNodeRef.current.stop();

    pausedAtRef.current = audioContext.currentTime - startedAtRef.current;
    sourceNodeRef.current = null;
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  // Global spacebar listener for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger while typing in an input
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePlayPause]);

  // Animation loop for updating currentTime
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    const loop = () => {
      if (audioContextRef.current) {
        setCurrentTime(audioContextRef.current.currentTime - startedAtRef.current);
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const seek = useCallback(
    (time: number) => {
      if (!audioBuffer) return;
      const newTime = Math.max(0, Math.min(time, audioBuffer.duration));

      pausedAtRef.current = newTime;
      setCurrentTime(newTime);

      if (isPlayingRef.current) {
        // Stop current playback and start a new one from the new position
        sourceNodeRef.current!.onended = null;
        sourceNodeRef.current!.stop();
        play();
      }
    },
    [audioBuffer, play],
  );

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
            snap={designSnap}
            setSnap={setDesignSnap}
            currentTime={currentTime}
            seek={seek}
          />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 bg-card rounded-lg border">
          <TimingTab map={map} setMap={setMap} songUrl={song?.url ?? null} currentTime={currentTime} />
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
        {!song?.url && (
          <div className="text-center text-muted-foreground p-4 bg-muted rounded-md h-[54px] flex items-center justify-center">
            Please select a song in the Metadata tab.
          </div>
        )}
      </footer>
    </main>
  );
}

export default App;

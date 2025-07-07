import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { useAppStore } from "@/store";
import { Button } from "./ui/button";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Label } from "./ui/label";

export function AudioPlayer() {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const { song, isPlaying, currentTime, setIsPlaying, setCurrentTime } = useAppStore();
  const subscribedCurrentTime = useAppStore((state) => state.currentTime);
  const [zoom, setZoom] = useState(100);
  const zoomLevels = [50, 100, 200, 400];

  useEffect(() => {
    if (!waveformRef.current) return;

    const options = {
      container: waveformRef.current,
      waveColor: "hsl(var(--muted-foreground))",
      progressColor: "hsl(var(--primary))",
      cursorColor: "hsl(var(--foreground))",
      barWidth: 2,
      barRadius: 3,
      responsive: false, // Required for scrollParent
      height: 80,
      normalize: true,
      partialRender: true,
      scrollParent: true,
      autoCenter: true,
      minPxPerSec: zoom,
    };

    const ws = WaveSurfer.create(options);
    wavesurfer.current = ws;

    if (song?.url) {
      ws.load(song.url);
    }

    const onReady = () => {
      const state = useAppStore.getState();
      ws.setTime(state.currentTime);
      if (state.isPlaying) {
        ws.play();
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onAudioprocess = (time: number) => setCurrentTime(time);
    const onSeek = () => setCurrentTime(ws.getCurrentTime());

    ws.on("ready", onReady);
    ws.on("play", onPlay);
    ws.on("pause", onPause);
    ws.on("audioprocess", onAudioprocess);
    ws.on("seek", onSeek);

    return () => {
      ws.un("ready", onReady);
      ws.un("play", onPlay);
      ws.un("pause", onPause);
      ws.un("audioprocess", onAudioprocess);
      ws.un("seek", onSeek);
      ws.destroy();
    };
  }, [song?.url, setIsPlaying, setCurrentTime, zoom]);

  useEffect(() => {
    const ws = wavesurfer.current;
    if (ws && Math.abs(ws.getCurrentTime() - subscribedCurrentTime) > 0.05) { // 50ms threshold to prevent loops
      ws.setTime(subscribedCurrentTime);
    }
  }, [subscribedCurrentTime]);

  const handlePlayPause = () => {
    wavesurfer.current?.playPause();
  };

  if (!song) {
    return (
      <div className="w-full flex flex-col gap-2 bg-card p-2 border rounded-lg h-[124px] items-center justify-center">
        <p className="text-muted-foreground">Please select a song in the Metadata tab.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2 bg-card p-2 border rounded-lg">
      <div id="waveform" ref={waveformRef} className="w-full h-[80px] cursor-pointer overflow-x-hidden" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button onClick={handlePlayPause} size="icon" variant="outline">
            {isPlaying ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
          </Button>
          <p className="text-sm text-muted-foreground font-mono">
            Time: {currentTime.toFixed(3)}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label>Zoom</Label>
          {zoomLevels.map((level) => (
            <Button key={level} variant={zoom === level ? "default" : "outline"} size="sm" onClick={() => setZoom(level)}>
              {level}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

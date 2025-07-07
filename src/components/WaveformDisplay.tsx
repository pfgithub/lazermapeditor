import { useCallback, useEffect, useRef, useState } from "react";
import { Map } from "@/store";

interface WaveformDisplayProps {
  songUrl: string | null | undefined;
  currentTime: number;
  map: Map;
  snap: number;
}

const DURATION_S = 3; // How many seconds of waveform to show

const getActiveTiming = (time: number, map: Map) => {
  if (map.timing.length === 0) {
    return { id: "default", bpm: 120, startTime: 0 };
  }
  return map.timing.findLast((s) => s.startTime <= time) ?? map.timing[0];
};

const getSnapTime = (time: number, direction: "next" | "prev", division: number, map: Map) => {
  const activeSegment = getActiveTiming(time, map);
  if (activeSegment.bpm <= 0) return time + (direction === "next" ? 1 : -1);

  const beatDuration = 60 / activeSegment.bpm;
  const snapDuration = beatDuration * (4 / division);

  const relativeTime = time - activeSegment.startTime;
  const numSnaps = relativeTime / snapDuration;

  const targetSnapIndex = direction === "next" ? Math.floor(numSnaps) + 1 : Math.ceil(numSnaps) - 1;

  return activeSegment.startTime + targetSnapIndex * snapDuration;
};

const drawSnapMarkers = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewStartTime: number,
  map: Map,
  snap: number,
) => {
  const viewEndTime = viewStartTime + DURATION_S;
  const timeToX = (lineTime: number) => ((lineTime - viewStartTime) / DURATION_S) * width;

  // Start drawing from the first visible snap line
  let currentLineTime = getSnapTime(viewStartTime - 0.001, "next", 16, map);

  for (let i = 0; i < 500 && currentLineTime < viewEndTime; i++) {
    const { bpm, startTime } = getActiveTiming(currentLineTime, map);
    if (bpm <= 0) {
      // Just move to the next 1/16th in case of 0 bpm
      currentLineTime = getSnapTime(currentLineTime, "next", 16, map);
      continue;
    }

    const beatDuration = 60 / bpm;
    const relativeTime = currentLineTime - startTime;

    // Add a small epsilon to handle floating point inaccuracies
    const isNth = (n: number) => {
      const divisionDuration = (beatDuration * 4) / n;
      if (divisionDuration < 0.001) return false;
      const numDivisions = relativeTime / divisionDuration;
      return Math.abs(numDivisions - Math.round(numDivisions)) < 0.001;
    };

    let strokeStyle = "";
    let lineWidth = 1;

    // Ordered from coarsest to finest for `else if` to work correctly.
    if (isNth(1)) {
      strokeStyle = "hsl(var(--destructive))";
      lineWidth = 1.5;
    } else if (isNth(2) && snap >= 2) {
      strokeStyle = "hsl(var(--foreground) / 0.8)";
      lineWidth = 1;
    } else if (isNth(4) && snap >= 4) {
      strokeStyle = "hsl(var(--foreground) / 0.6)";
      lineWidth = 1;
    } else if (isNth(8) && snap >= 8) {
      strokeStyle = "hsl(var(--foreground) / 0.4)";
      lineWidth = 0.75;
    } else if (isNth(16) && snap >= 16) {
      strokeStyle = "hsl(var(--foreground) / 0.3)";
      lineWidth = 0.5;
    }

    if (strokeStyle) {
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      const x = timeToX(currentLineTime);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.restore();
    }

    currentLineTime = getSnapTime(currentLineTime, "next", 16, map);
  }
};

const drawWaveform = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  buffer: AudioBuffer,
  time: number,
) => {
  ctx.fillStyle = "hsl(var(--primary) / 0.6)";

  const channelData = buffer.getChannelData(0); // Use first channel
  const { sampleRate, length: bufferLength } = buffer;
  const startSample = Math.floor(time * sampleRate);

  const totalSamplesInView = DURATION_S * sampleRate;
  const samplesPerPixel = totalSamplesInView / width;

  for (let x = 0; x < width; x++) {
    const sampleStartIndex = startSample + Math.floor(x * samplesPerPixel);
    const sampleEndIndex = sampleStartIndex + Math.ceil(samplesPerPixel);

    if (sampleStartIndex >= bufferLength) {
      break;
    }

    let min = 1.0;
    let max = -1.0;

    for (let i = sampleStartIndex; i < sampleEndIndex; i++) {
      if (i >= bufferLength) break;
      const sample = channelData[i];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    if (min === 1.0 && max === -1.0) {
      // No samples found in range
      min = 0;
      max = 0;
    }

    const y_max = ((1 - max) / 2) * height;
    const y_min = ((1 - min) / 2) * height;

    const rectHeight = Math.max(1, y_min - y_max);

    ctx.fillRect(x, y_max, 1, rectHeight);
  }
};

export function WaveformDisplay({ songUrl, currentTime, map, snap }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!songUrl) {
      setAudioBuffer(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const audioContext = new AudioContext();

    fetch(songUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((decodedData) => {
        setAudioBuffer(decodedData);
      })
      .catch((err) => {
        console.error("Error decoding audio data:", err);
        setError("Could not decode audio file.");
        setAudioBuffer(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      audioContext.close().catch((e) => console.error("Error closing AudioContext", e));
      setAudioBuffer(null);
    };
  }, [songUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { width, height } = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, width, height);

    if (!audioBuffer) {
      return;
    }

    drawWaveform(ctx, width, height, audioBuffer, currentTime);
    drawSnapMarkers(ctx, width, height, currentTime, map, snap);
  }, [audioBuffer, currentTime, map, snap]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);
      draw();
    });
    resizeObserver.observe(container);

    // Initial size and draw
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
    draw();

    return () => resizeObserver.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-muted/50 rounded-lg overflow-hidden border">
      <canvas ref={canvasRef} className="absolute top-0 left-0" />
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm p-4 text-center pointer-events-none">
        {isLoading && <p>Loading waveform...</p>}
        {error && <p>{error}</p>}
        {!isLoading && !error && !songUrl && <p>Load a song in the Metadata tab to see the waveform.</p>}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, type WheelEvent } from "react";
import type { Beatmap } from "@/store";
import {
  calculateTimingPointsInRange,
  findNextSnap,
  findPreviousSnap,
  getColorForSnap,
  getSnapForTime,
  type Snap,
} from "@/lib/timingPoints";

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null;
  isSongLoading: boolean;
  getCurrentTime: () => number;
  seek: (time: number) => void;
  map: Beatmap;
  snap: Snap;
}

const DURATION_S = 3; // How many seconds of waveform to show

const drawNotes = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewStartTime: number,
  map: Beatmap,
) => {
  const viewEndTime = viewStartTime + DURATION_S;
  const timeToX = (time: number) => ((time - viewStartTime) / DURATION_S) * width;

  const laneHeight = height / 4;
  const noteHeight = laneHeight * 0.8;
  const noteYOffset = laneHeight * 0.1;

  for (const note of map.notes) {
    if (note.endTime < viewStartTime || note.startTime > viewEndTime) {
      continue;
    }

    const x_start = timeToX(note.startTime);
    const y = note.key * laneHeight + noteYOffset;
    const color = getColorForSnap(getSnapForTime(map, note.startTime));

    if (note.startTime === note.endTime) {
      // Tap note
      ctx.fillStyle = color;
      ctx.fillRect(x_start - 1.5, y, 3, noteHeight);
    } else {
      // Hold note, draw as a rectangle
      const x_end = timeToX(note.endTime);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x_start, y, x_end - x_start, noteHeight);

      // Add border to hold notes
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x_start, y, x_end - x_start, noteHeight);
    }
  }
};

const drawPlayhead = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const x = width / 2;
  ctx.strokeStyle = "hsl(0, 0%, 100%)"; // Opaque white
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.globalAlpha = 1.0;
};

const drawSnapMarkers = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewStartTime: number,
  map: Beatmap,
  snap: Snap,
) => {
  const viewEndTime = viewStartTime + DURATION_S;
  const timeToX = (lineTime: number) => ((lineTime - viewStartTime) / DURATION_S) * width;

  const timingPoints = calculateTimingPointsInRange(map, viewStartTime, viewEndTime, snap);

  for (const time of timingPoints) {
    const pointSnap = getSnapForTime(map, time);
    const strokeStyle = getColorForSnap(pointSnap);
    let lineWidth = 1;

    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    const x = timeToX(time);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
  }
};

const drawWaveform = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  buffer: AudioBuffer,
  time: number,
  primaryColor: string,
) => {
  ctx.fillStyle = primaryColor;

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

export function WaveformDisplay({ audioBuffer, isSongLoading, getCurrentTime, map, snap, seek }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryColor = "hsl(217.2 91.2% 59.8% / 0.6)";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    ctx.clearRect(0, 0, width, height);

    if (!audioBuffer) {
      return;
    }

    const viewStartTime = getCurrentTime() - DURATION_S / 2;

    drawWaveform(ctx, width, height, audioBuffer, viewStartTime, primaryColor);
    drawSnapMarkers(ctx, width, height, viewStartTime, map, snap);
    drawNotes(ctx, width, height, viewStartTime, map);
    drawPlayhead(ctx, width, height);
  }, [audioBuffer, map, snap, getCurrentTime]);

  useEffect(() => {
    let animationFrame: number;
    const next = () => {
      draw();
      animationFrame = requestAnimationFrame(next);
    };
    next();
    return () => cancelAnimationFrame(animationFrame);
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

  const handleWheel = (e: WheelEvent) => {
    if (!audioBuffer) return;
    e.preventDefault();

    const delta = e.deltaY || e.deltaX;
    if (delta === 0) return;

    let nextTime: number | null = null;

    if (delta > 0) {
      // Scroll down or right -> forward in time
      nextTime = findNextSnap(map, getCurrentTime(), snap);
    } else {
      // delta < 0
      // Scroll up or left -> backward in time
      nextTime = findPreviousSnap(map, getCurrentTime(), snap);
    }

    if (nextTime !== null) {
      seek(nextTime);
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="w-full h-full relative bg-[hsl(217.2,32.6%,17.5%)]/50 rounded-lg overflow-hidden border border-[hsl(217.2,32.6%,17.5%)]"
    >
      <canvas ref={canvasRef} className="absolute top-0 left-0" />
      <div className="absolute inset-0 flex items-center justify-center text-[hsl(215,20.2%,65.1%)] text-sm p-4 text-center pointer-events-none">
        {isSongLoading ? (
          <p>Loading song...</p>
        ) : !audioBuffer ? (
          <p>Load a song in the Metadata tab to see the waveform.</p>
        ) : null}
      </div>
    </div>
  );
}

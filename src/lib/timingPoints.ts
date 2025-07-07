import type { Map, TimingSegment } from "@/store";

export function calculateTimingPointsInRange(map: Map, startTime: number, endTime: number, divisionCount: Snap): number[] {
  type RenderSegment = {start: number, end: number, segment: TimingSegment};
  const renderSegments: RenderSegment[] = [];
  for(let i = 0; i < map.timing.length; i++) {
    const segment = map.timing[i]!;
    const nextSegment = map.timing[i + 1];
    const renderSegment: RenderSegment = {start: Math.max(startTime, segment.startTime), end: Math.min(endTime, nextSegment?.startTime ?? Infinity), segment};
    if(renderSegment.end < startTime || renderSegment.start > endTime) continue; // outside of range; skip
    renderSegments.push(renderSegment);
  }

  const results: number[] = [];
  for(const renderSegment of renderSegments) {
    const beatDuration = 60 / renderSegment.segment.bpm / divisionCount;
    const firstBeatMarkerTime = renderSegment.segment.startTime;
    const startIndex = Math.ceil((renderSegment.start - firstBeatMarkerTime) / beatDuration);
    for(let i = startIndex; ; i++) {
      const beatTime = firstBeatMarkerTime + i * beatDuration;
      if(beatTime > renderSegment.end) break;
      
      results.push(beatTime);
    }
  }

  return results;
}

export function findNextSnap(map: Map, time: number, snap: Snap): number | null {
  // A small epsilon to avoid getting the current time back
  const points = calculateTimingPointsInRange(map, time + 0.00001, time + 10, snap);
  if (points.length > 0) return points[0];
  return null;
}

export function findPreviousSnap(map: Map, time: number, snap: Snap): number | null {
  // A small epsilon to avoid getting the current time back
  const points = calculateTimingPointsInRange(map, time - 10, time - 0.00001, snap);
  if (points.length > 0) return points[points.length - 1];
  return null;
}

export function findNearestSnap(map: Map, time: number, snap: Snap): number | null {
  const points = calculateTimingPointsInRange(map, time - 10, time + 10, snap);
  let nearest: number | null = null;
  for(const point of points) {
    if(nearest == null || Math.abs(point - time) < Math.abs(nearest - time)) {
      nearest = point;
    }
  }
  return nearest;
}

export type Snap = 1 | 2 | 4 | 8 | 16 | 3 | 6 | 12 | 24;
export const snapLevels: Snap[] = [1, 2, 4, 8, 16, 3, 6, 12, 24];

export function getSnapForTime(map: Map, time: number): Snap | undefined {
  let segment: TimingSegment | undefined;
  for(const timingSegment of map.timing) {
    if(timingSegment.startTime <= time) segment = timingSegment;
  }
  if(!segment) return undefined;

  const isNth = (divisionCount: number) => {
    const divisionDuration = 60 / segment.bpm / divisionCount;
    const numDivisions = (time - segment.startTime) / divisionDuration;
    const EPSILON = 0.00001;
    return Math.abs(numDivisions - Math.round(numDivisions)) < EPSILON;
  };
  if(isNth(1)) return 1;
  if(isNth(2)) return 2;
  if(isNth(4)) return 4;
  if(isNth(8)) return 8;
  if(isNth(16)) return 16;
  if(isNth(3)) return 3;
  if(isNth(6)) return 6;
  if(isNth(12)) return 12;
  if(isNth(24)) return 24;
  return undefined; // mistimed
}

export function getColorForSnap(snap: Snap | undefined) {
  if(snap === 1) return "black";
  if(snap === 2) return "red";
  if(snap === 4) return "blue";
  if(snap === 8) return "yellow";
  if(snap === 16) return "RebeccaPurple";
  if(snap === 3) return "MediumPurple";
  if(snap === 6) return "Wheat";
  if(snap === 12) return "SandyBrown";
  return "gray";
}

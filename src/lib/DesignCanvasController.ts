import type { Key, Map } from "@/store";
import {
  calculateTimingPointsInRange,
  findNearestSnap,
  getColorForSnap,
  getSnapForTime,
  type Snap,
} from "@/lib/timingPoints";

const getKeyId = (key: Key): string => `${key.startTime}-${key.key}`;

type SetStateAction<S> = S | ((prevState: S) => S);

type DragContext =
  | {
      type: "select";
      x1: number;
      t1: number;
    }
  | {
      type: "drag";
      initialMouseTime: number;
      initialMouseLane: number;
      originalKeys: Map<string, Key>; // Map from key ID to original key object
    }
  | null;

export interface DesignCanvasControllerOptions {
  canvas: HTMLCanvasElement;
  map: Map;
  getCurrentTime: () => number;
  snap: Snap;
  selectedKeyIds: Set<string>;
  draggedKeysPreview: Key[] | null;
  themeColors: {
    border: string;
    ring: string;
    ringTransparent: string;
  };
  activeHolds: Partial<Record<0 | 1 | 2 | 3, number>>;
  setMap: (map: Map) => void;
  setSelectedKeyIds: (value: SetStateAction<Set<string>>) => void;
  setDraggedKeysPreview: (keys: Key[] | null) => void;
}

export class DesignCanvasController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: Map;
  private getCurrentTime: () => number;
  private snap: Snap;
  private selectedKeyIds: Set<string>;
  private draggedKeysPreview: Key[] | null;
  private selectionBox: { x1: number; t1: number; x2: number; t2: number } | null;
  private themeColors: { border: string; ring: string; ringTransparent: string };
  private activeHolds: Partial<Record<0 | 1 | 2 | 3, number>>;

  private setMap: (map: Map) => void;
  private setSelectedKeyIds: (value: SetStateAction<Set<string>>) => void;
  private setDraggedKeysPreview: (keys: Key[] | null) => void;

  private dragContext: DragContext = null;

  constructor(options: DesignCanvasControllerOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get canvas context");
    }
    this.ctx = context;

    this.map = options.map;
    this.getCurrentTime = options.getCurrentTime;
    this.snap = options.snap;
    this.selectedKeyIds = options.selectedKeyIds;
    this.draggedKeysPreview = options.draggedKeysPreview;
    this.themeColors = options.themeColors;
    this.activeHolds = options.activeHolds;

    this.setMap = options.setMap;
    this.setSelectedKeyIds = options.setSelectedKeyIds;
    this.setDraggedKeysPreview = options.setDraggedKeysPreview;
  }

  public update(
    options: Partial<
      Omit<
        DesignCanvasControllerOptions,
        "canvas" | "getCurrentTime" | "setMap" | "setSelectedKeyIds" | "setDraggedKeysPreview"
      >
    >,
  ) {
    Object.assign(this, options);
  }

  public posToY(lineTime: number): number {
    const { height } = this.canvas.getBoundingClientRect();
    if (height === 0) return 0;
    const startTime = this.getCurrentTime() - 0.1;
    const endTime = this.getCurrentTime() + 1.0;
    return height - ((lineTime - startTime) / (endTime - startTime)) * height;
  }

  public yToPos(y: number): number {
    const { height } = this.canvas.getBoundingClientRect();
    const startTime = this.getCurrentTime() - 0.1;
    if (height === 0) return startTime;

    const endTime = this.getCurrentTime() + 1.0;
    const lineTime = startTime + ((height - y) / height) * (endTime - startTime);
    return lineTime;
  }

  public findKeyAt(x: number, y: number): Key | null {
    const rect = this.canvas.getBoundingClientRect();
    const numLanes = 4;
    const laneWidth = rect.width / numLanes;
    const lane = Math.floor(x / laneWidth);
    const viewStartTime = this.getCurrentTime() - 0.1;
    const viewEndTime = this.getCurrentTime() + 1.0;
    let clickedKey: Key | null = null;
    let minDistance = Infinity;

    for (const key of this.map.keys) {
      if (key.key !== lane) continue;
      if (key.endTime < viewStartTime || key.startTime > viewEndTime) continue;

      const y_start = this.posToY(key.startTime);
      const y_end = this.posToY(key.endTime);

      const isTap = key.startTime === key.endTime;
      const isYInRange = isTap
        ? y >= y_start - 5 && y <= y_start + 5
        : y >= y_end && y <= y_start;

      if (isYInRange) {
        const y_center = isTap ? y_start : (y_start + y_end) / 2;
        const distance = Math.abs(y - y_center);
        if (distance < minDistance) {
          minDistance = distance;
          clickedKey = key;
        }
      }
    }
    return clickedKey;
  }

  public getKeysInBox(x1: number, t1: number, x2: number, t2: number): Key[] {
    const y1 = this.posToY(t1);
    const y2 = this.posToY(t2);
    const rect = this.canvas.getBoundingClientRect();
    const numLanes = 4;
    const laneWidth = rect.width / numLanes;
    const boxLeft = Math.min(x1, x2);
    const boxRight = Math.max(x1, x2);
    const boxTop = Math.min(y1, y2);
    const boxBottom = Math.max(y1, y2);
    const selectedKeys: Key[] = [];

    for (const key of this.map.keys) {
      const keyLeft = key.key * laneWidth;
      const keyRight = (key.key + 1) * laneWidth;
      if (keyLeft > boxRight || keyRight < boxLeft) continue;

      const y_start = this.posToY(key.startTime);
      const y_end = this.posToY(key.endTime);

      const isTap = key.startTime === key.endTime;
      if (isTap) {
        const keyRectTop = y_start - 5;
        const keyRectBottom = y_start + 5;
        if (keyRectTop < boxBottom && keyRectBottom > boxTop) {
          selectedKeys.push(key);
        }
      } else {
        if (y_end < boxBottom && y_start > boxTop) {
          selectedKeys.push(key);
        }
      }
    }
    return selectedKeys;
  }

  public handleMouseDown(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const numLanes = 4;
    const laneWidth = rect.width / numLanes;

    const clickedKey = this.findKeyAt(x, y);
    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;

    if (clickedKey) {
      const keyId = getKeyId(clickedKey);
      const isSelected = this.selectedKeyIds.has(keyId);
      let nextSelectedKeyIds = new Set(this.selectedKeyIds);
      let selectionChanged = false;

      if (isMultiSelect) {
        if (isSelected) {
          nextSelectedKeyIds.delete(keyId);
        } else {
          nextSelectedKeyIds.add(keyId);
        }
        selectionChanged = true;
      } else {
        if (!isSelected || this.selectedKeyIds.size > 1) {
          nextSelectedKeyIds = new Set([keyId]);
          selectionChanged = true;
        }
      }

      if (selectionChanged) {
        this.setSelectedKeyIds(nextSelectedKeyIds);
      }

      // Only start a drag if we're not deselecting with a multi-select key.
      if (isMultiSelect && isSelected) {
        this.dragContext = null;
      } else {
        const keysToDrag = new Map<string, Key>();
        this.map.keys.forEach((k) => {
          if (nextSelectedKeyIds.has(getKeyId(k))) {
            keysToDrag.set(getKeyId(k), k);
          }
        });

        this.dragContext = {
          type: "drag",
          initialMouseTime: this.yToPos(y),
          initialMouseLane: Math.floor(x / laneWidth),
          originalKeys: keysToDrag,
        };
      }
    } else {
      // No key clicked, start box selection
      if (!isMultiSelect) {
        this.setSelectedKeyIds(new Set());
      }
      const time = this.yToPos(y);
      this.dragContext = {
        type: "select",
        x1: x,
        t1: time,
      };
      this.selectionBox = { x1: x, t1: time, x2: x, t2: time };
    }
  }

  public handleMouseMove(e: MouseEvent) {
    if (!this.dragContext) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const context = this.dragContext;
    if (context.type === "select") {
      this.selectionBox = { x1: context.x1, t1: context.t1, x2: x, t2: this.yToPos(y) };
    } else {
      // type is 'drag'
      const numLanes = 4;
      const laneWidth = rect.width / numLanes;
      const currentTime = this.yToPos(y);
      const currentLane = Math.floor(x / laneWidth);

      const timeDelta = currentTime - context.initialMouseTime;
      const laneDelta = currentLane - context.initialMouseLane;

      const minKey = Math.min(...Array.from(context.originalKeys.values()).map((k) => k.key));
      const maxKey = Math.max(...Array.from(context.originalKeys.values()).map((k) => k.key));

      let adjustedLaneDelta = laneDelta;
      if (minKey + laneDelta < 0) {
        adjustedLaneDelta = -minKey;
      }
      if (maxKey + laneDelta >= numLanes) {
        adjustedLaneDelta = numLanes - 1 - maxKey;
      }

      const newKeys: Key[] = [];
      for (const originalKey of context.originalKeys.values()) {
        const newStartTime = originalKey.startTime + timeDelta;
        const snappedStartTime = findNearestSnap(this.map, newStartTime, this.snap);

        if (snappedStartTime === null) continue;

        const snappedTimeDelta = snappedStartTime - originalKey.startTime;

        newKeys.push({
          ...originalKey,
          startTime: originalKey.startTime + snappedTimeDelta,
          endTime: originalKey.endTime + snappedTimeDelta,
          key: (originalKey.key + adjustedLaneDelta) as Key["key"],
        });
      }
      this.setDraggedKeysPreview(newKeys);
    }
  }

  public handleMouseUp(e: MouseEvent) {
    if (!this.dragContext) return;

    const context = this.dragContext;

    if (context.type === "select") {
      if (this.selectionBox) {
        const { x1, t1, x2, t2 } = this.selectionBox;
        const y1 = this.posToY(t1);
        const y2 = this.posToY(t2);
        const dragDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

        if (dragDistance > 5) {
          const keysInBox = this.getKeysInBox(x1, t1, x2, t2);
          const keyIdsInBox = new Set(keysInBox.map(getKeyId));

          const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
          if (isMultiSelect) {
            this.setSelectedKeyIds((prev) => {
              const newSelection = new Set(prev);
              keyIdsInBox.forEach((id) => newSelection.add(id));
              return newSelection;
            });
          } else {
            this.setSelectedKeyIds(keyIdsInBox);
          }
        }
      }
      this.selectionBox = null;
    } else {
      // type is 'drag'
      if (this.draggedKeysPreview) {
        const draggedKeyOriginalIds = new Set(context.originalKeys.keys());
        const otherKeys = this.map.keys.filter((k) => !draggedKeyOriginalIds.has(getKeyId(k)));

        const newKeys = [...otherKeys, ...this.draggedKeysPreview].sort((a, b) => a.startTime - b.startTime);
        this.setMap({ ...this.map, keys: newKeys });

        const newSelectedKeyIds = new Set(this.draggedKeysPreview.map(getKeyId));
        this.setSelectedKeyIds(newSelectedKeyIds);
      }
      this.setDraggedKeysPreview(null);
    }
    this.dragContext = null;
  }

  public draw() {
    const ctx = this.ctx;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const dpr = window.devicePixelRatio;
    ctx.save();
    ctx.scale(dpr, dpr);

    const time = this.getCurrentTime();
    const numLanes = 4;
    const laneWidth = width / numLanes;
    const viewStartTime = time - 0.1;
    const viewEndTime = time + 1.0;

    // --- Draw Columns for 4K ---
    ctx.strokeStyle = this.themeColors.border;
    ctx.lineWidth = 1;
    for (let i = 1; i < numLanes; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, height);
      ctx.stroke();
    }

    // --- Draw Timing Lines ---
    const timingPoints = calculateTimingPointsInRange(this.map, viewStartTime, viewEndTime, this.snap);
    for (const timingPoint of timingPoints) {
      const pointSnap = getSnapForTime(this.map, timingPoint);
      ctx.strokeStyle = getColorForSnap(pointSnap);
      ctx.lineWidth = 1;
      const y = this.posToY(timingPoint);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const drawKey = (key: Key, isSelected: boolean) => {
      if (key.endTime < viewStartTime || key.startTime > viewEndTime) return;

      const y_start = this.posToY(key.startTime);
      const y_end = this.posToY(key.endTime);
      const x_start = key.key * laneWidth;
      const color = getColorForSnap(getSnapForTime(this.map, key.startTime));

      if (key.startTime === key.endTime) {
        // Tap Note
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x_start + 5, y_start);
        ctx.lineTo(x_start + laneWidth - 5, y_start);
        ctx.stroke();
        if (isSelected) {
          ctx.strokeStyle = this.themeColors.ring;
          ctx.lineWidth = 2;
          ctx.strokeRect(x_start + 3, y_start - 5, laneWidth - 6, 10);
        }
      } else {
        // Hold Note
        const noteWidth = laneWidth - 10;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(x_start + 5, y_end, noteWidth, y_start - y_end);
        ctx.globalAlpha = 1.0;
        ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
        if (isSelected) {
          ctx.strokeStyle = this.themeColors.ring;
          ctx.lineWidth = 4;
          ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
        }
      }
    };

    const draggedOriginalKeys = this.dragContext?.type === "drag" ? this.dragContext.originalKeys : null;
    // --- Draw Keys ---
    for (const key of this.map.keys) {
      const keyId = getKeyId(key);
      if (draggedOriginalKeys?.has(keyId)) continue;
      drawKey(key, this.selectedKeyIds.has(keyId));
    }

    // --- Draw in-progress notes ---
    for (const [lane, startTime] of Object.entries(this.activeHolds)) {
      drawKey({
        startTime,
        endTime: findNearestSnap(this.map, time, this.snap) ?? time,
        key: +lane as Key["key"],
      }, false);
    }

    // --- Draw Dragged Keys Preview ---
    if (this.draggedKeysPreview) {
      for (const key of this.draggedKeysPreview) {
        if (key.endTime < viewStartTime || key.startTime > viewEndTime) continue;
        const y_start = this.posToY(key.startTime);
        const y_end = this.posToY(key.endTime);
        const x_start = key.key * laneWidth;
        const color = getColorForSnap(getSnapForTime(this.map, key.startTime));

        if (key.startTime === key.endTime) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(x_start + 5, y_start);
          ctx.lineTo(x_start + laneWidth - 5, y_start);
          ctx.stroke();
          ctx.strokeStyle = this.themeColors.ring;
          ctx.lineWidth = 2;
          ctx.strokeRect(x_start + 3, y_start - 5, laneWidth - 6, 10);
        } else {
          const noteWidth = laneWidth - 10;
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(x_start + 5, y_end, noteWidth, y_start - y_end);
          ctx.globalAlpha = 1.0;
          ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
          ctx.strokeStyle = this.themeColors.ring;
          ctx.lineWidth = 4;
          ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
        }
      }
    }

    // --- Draw Selection Box ---
    if (this.selectionBox) {
      const { x1, t1, x2, t2 } = this.selectionBox;
      const y1 = this.posToY(t1);
      const y2 = this.posToY(t2);
      ctx.fillStyle = this.themeColors.ringTransparent;
      ctx.strokeStyle = this.themeColors.ring;
      ctx.lineWidth = 1;
      const rectX = Math.min(x1, x2);
      const rectY = Math.min(y1, y2);
      const rectW = Math.abs(x1 - x2);
      const rectH = Math.abs(y1 - y2);
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
    }

    // --- Draw Judgement Line ---
    ctx.strokeStyle = getColorForSnap(getSnapForTime(this.map, time));
    ctx.lineWidth = 3;
    const judgementY = this.posToY(time);
    ctx.beginPath();
    ctx.moveTo(0, judgementY);
    ctx.lineTo(width, judgementY);
    ctx.stroke();

    ctx.restore();
  }
}

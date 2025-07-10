import type { Note, Beatmap, Keybinds, KeybindAction, SvSegment } from "@/store";
import {
  calculateTimingPointsInRange,
  findNearestSnap,
  getColorForSnap,
  getSnapForTime,
  type Snap,
} from "@/lib/timingPoints";
import { allowKeyEvent } from "./utils";

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
      originalKeys: Set<Note>;
      newKeys: Set<Note>;
    }
  | null;

type ClipboardNote = {
  relativeStartTime: number;
  relativeEndTime: number;
  key: 0 | 1 | 2 | 3;
};

export interface DesignCanvasControllerOptions {
  canvas: HTMLCanvasElement;
  map: Beatmap;
  getCurrentTime: () => number;
  snap: Snap;
  keybinds: Keybinds;
  setMap: (map: Beatmap) => void;
  onSelectionChange?: (count: number) => void;
}

const themeColors = {
  border: "hsl(217.2 32.6% 17.5%)",
  ring: "hsl(217.2 91.2% 59.8%)",
  ringTransparent: "hsla(217.2 91.2% 59.8% / 0.2)",
};

type KeyMapEntry = 0 | 1 | 2 | 3 | "sv";
export class DesignCanvasController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: Beatmap;
  private getCurrentTime: () => number;
  private snap: Snap;
  private keybinds: Keybinds;
  private keyMap: { [code: string]: KeyMapEntry };

  private setMap: (map: Beatmap) => void;
  private onSelectionChange: (count: number) => void;

  private dragContext: DragContext = null;

  activeHolds: Map<KeyMapEntry, number> = new Map();
  selectedKeyIds: Set<Note> = new Set();
  selectionBox: { x1: number; t1: number; x2: number; t2: number } | null = null;

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
    this.keybinds = options.keybinds;
    this.keyMap = this.generateKeyMap(options.keybinds);

    this.setMap = options.setMap;
    this.onSelectionChange = options.onSelectionChange ?? (() => {});
  }

  public update(
    options: Partial<
      Omit<
        DesignCanvasControllerOptions,
        "canvas" | "getCurrentTime" | "setMap" | "onSelectionChange"
      >
    >,
  ) {
    if (options.keybinds && options.keybinds !== this.keybinds) {
      this.keybinds = options.keybinds;
      this.keyMap = this.generateKeyMap(options.keybinds);
    }
    if (options.map) this.map = options.map;
    if (options.snap) this.snap = options.snap;
  }

  private generateKeyMap(keybinds: Keybinds): { [code: string]: KeyMapEntry } {
    const keyMap: { [code: string]: KeyMapEntry } = {};
    const actions: KeybindAction[] = [
      "placeNoteLane1",
      "placeNoteLane2",
      "placeNoteLane3",
      "placeNoteLane4",
    ];
    actions.forEach((action, index) => {
      (keybinds[action] || []).forEach((key) => {
        if (key) keyMap[key] = index as KeyMapEntry;
      });
    });
    for (const k of keybinds["placeSV"] ?? []) {
      if (k) keyMap[k] = "sv";
    }
    return keyMap;
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

  public findKeyAt(x: number, y: number): Note | null {
    const rect = this.canvas.getBoundingClientRect();
    const numLanes = 4;
    const laneWidth = rect.width / numLanes;
    const lane = Math.floor(x / laneWidth);
    const viewStartTime = this.getCurrentTime() - 0.1;
    const viewEndTime = this.getCurrentTime() + 1.0;
    let clickedKey: Note | null = null;
    let minDistance = Infinity;

    for (const key of this.map.notes) {
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

  public getKeysInBox(x1: number, t1: number, x2: number, t2: number): Note[] {
    const y1 = this.posToY(t1);
    const y2 = this.posToY(t2);
    const rect = this.canvas.getBoundingClientRect();
    const numLanes = 4;
    const laneWidth = rect.width / numLanes;
    const boxLeft = Math.min(x1, x2);
    const boxRight = Math.max(x1, x2);
    const boxTop = Math.min(y1, y2);
    const boxBottom = Math.max(y1, y2);
    const selectedKeys: Note[] = [];

    for (const key of this.map.notes) {
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
      const isSelected = this.selectedKeyIds.has(clickedKey);

      if (isMultiSelect) {
        if (isSelected) {
          this.selectedKeyIds.delete(clickedKey);
        } else {
          this.selectedKeyIds.add(clickedKey);
        }
      } else {
        if (!isSelected) {
          this.selectedKeyIds.clear();
          this.selectedKeyIds.add(clickedKey);
        }
      }

      // Only start a drag if we're not deselecting with a multi-select key.
      if (isMultiSelect && isSelected) {
        this.dragContext = null;
      } else {
        const keysToDrag = new Set<Note>();
        this.map.notes.forEach((k) => {
          if (this.selectedKeyIds.has(k)) {
            keysToDrag.add(k);
          }
        });

        this.dragContext = {
          type: "drag",
          initialMouseTime: this.yToPos(y),
          initialMouseLane: Math.floor(x / laneWidth),
          originalKeys: keysToDrag,
          newKeys: new Set(keysToDrag),
        };
      }
    } else {
      // No key clicked, start box selection
      if (!isMultiSelect) {
        this.selectedKeyIds.clear();
      }
      const time = this.yToPos(y);
      this.dragContext = {
        type: "select",
        x1: x,
        t1: time,
      };
      this.selectionBox = { x1: x, t1: time, x2: x, t2: time };
    }
    this.onSelectionChange(this.selectedKeyIds.size);
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

      const anchorNote = context.originalKeys.values().next().value as Note | undefined;
      let timeDeltaToApply = timeDelta;

      if (anchorNote) {
        const newAnchorTime = anchorNote.startTime + timeDelta;
        const snappedAnchorTime = findNearestSnap(this.map, newAnchorTime, this.snap);
        if (snappedAnchorTime !== null) {
          timeDeltaToApply = snappedAnchorTime - anchorNote.startTime;
        }
      }

      context.newKeys.clear();
      for (const originalKey of context.originalKeys.values()) {
        context.newKeys.add({
          ...originalKey,
          startTime: originalKey.startTime + timeDeltaToApply,
          endTime: originalKey.endTime + timeDeltaToApply,
          key: (originalKey.key + adjustedLaneDelta) as Note["key"],
        });
      }
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
          const keyIdsInBox = new Set(keysInBox);

          const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
          if (isMultiSelect) {
            keyIdsInBox.forEach((id) => this.selectedKeyIds.add(id));
          } else {
            this.selectedKeyIds = keyIdsInBox;
          }
        }
      }
      this.selectionBox = null;
    } else {
      // type is 'drag'
      const otherKeys = this.map.notes.filter((k) => !context.originalKeys.has(k));

      const newKeys = [...otherKeys, ...context.newKeys].sort((a, b) => a.startTime - b.startTime);
      this.setMap({ ...this.map, notes: newKeys });

      const newSelectedKeyIds = new Set(context.newKeys);
      this.selectedKeyIds = newSelectedKeyIds;
    }
    this.dragContext = null;
    this.onSelectionChange(this.selectedKeyIds.size);
  }

  private async handleCopy() {
    if (this.selectedKeyIds.size === 0) return;

    const selectedNotes = Array.from(this.selectedKeyIds);
    if (selectedNotes.length === 0) return;

    // Find the earliest start time to make other times relative
    const baseTime = Math.min(...selectedNotes.map((n) => n.startTime));

    const clipboardData: ClipboardNote[] = selectedNotes.map((note) => ({
      key: note.key,
      relativeStartTime: note.startTime - baseTime,
      relativeEndTime: note.endTime - baseTime,
    }));

    try {
      await navigator.clipboard.writeText(JSON.stringify(clipboardData));
    } catch (err) {
      console.error("Failed to copy notes to clipboard:", err);
    }
  }

  private async handlePaste() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const potentialNotes = JSON.parse(clipboardText);

      // Basic validation
      if (!Array.isArray(potentialNotes) || potentialNotes.length === 0) {
        return;
      }

      const clipboardNotes = potentialNotes as ClipboardNote[];

      const pasteTime = findNearestSnap(this.map, this.getCurrentTime(), this.snap) ?? this.getCurrentTime();

      const newNotes: Note[] = [];
      for (const clipboardNote of clipboardNotes) {
        // More validation
        if (
          typeof clipboardNote.key !== "number" ||
          ![0, 1, 2, 3].includes(clipboardNote.key) ||
          typeof clipboardNote.relativeStartTime !== "number" ||
          typeof clipboardNote.relativeEndTime !== "number"
        ) {
          console.warn("Invalid note format in clipboard, skipping note:", clipboardNote);
          continue;
        }

        const newNote: Note = {
          key: clipboardNote.key as Note["key"],
          startTime: pasteTime + clipboardNote.relativeStartTime,
          endTime: pasteTime + clipboardNote.relativeEndTime,
        };
        newNotes.push(newNote);
      }

      // Deselect old notes
      this.selectedKeyIds.clear();

      // Add new notes to map
      const updatedNotes = [...this.map.notes, ...newNotes].sort((a, b) => a.startTime - b.startTime);
      this.setMap({ ...this.map, notes: updatedNotes });

      // Select the new notes.
      newNotes.forEach((note) => this.selectedKeyIds.add(note));
      this.onSelectionChange(this.selectedKeyIds.size);
    } catch (err) {
      console.warn("Failed to paste notes from clipboard:", err);
    }
  }

  private handleDelete() {
    if (this.selectedKeyIds.size === 0) return;

    const newKeys = this.map.notes.filter((key) => !this.selectedKeyIds.has(key));

    this.setMap({ ...this.map, notes: newKeys });
    this.selectedKeyIds.clear();
    this.onSelectionChange(this.selectedKeyIds.size);
  }

  public flipHorizontal() {
    if (this.selectedKeyIds.size === 0) return;

    const newFlippedNotes: Note[] = [];
    const selectedNotes = this.selectedKeyIds;

    for (const note of selectedNotes) {
      const newNote: Note = {
        ...note,
        key: (3 - note.key) as Note["key"],
      };
      newFlippedNotes.push(newNote);
    }

    const unselectedNotes = this.map.notes.filter((note) => !selectedNotes.has(note));

    const allNotes = [...unselectedNotes, ...newFlippedNotes].sort((a, b) => a.startTime - b.startTime);

    this.setMap({ ...this.map, notes: allNotes });

    this.selectedKeyIds = new Set(newFlippedNotes);
    this.onSelectionChange(this.selectedKeyIds.size);
  }

  public handleKeyDown(e: KeyboardEvent) {
    if (!allowKeyEvent(e)) return;

    // --- Copy, Paste, Delete ---
    if (e.ctrlKey || e.metaKey) {
      if (e.code === "KeyC") {
        e.preventDefault();
        this.handleCopy();
        return;
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        this.handlePaste();
        return;
      }
    }

    if (this.keybinds.deleteSelection.includes(e.code)) {
      if (this.selectedKeyIds.size > 0) {
        e.preventDefault();
        this.handleDelete();
      }
      return;
    }

    // --- Place Note ---
    const keyIndex = this.keyMap[e.code];
    if (keyIndex === undefined || e.repeat) return;

    if (this.activeHolds.get(keyIndex) != null) return;

    const nearestTime = findNearestSnap(this.map, this.getCurrentTime(), this.snap);
    if (nearestTime === null) return;

    e.preventDefault();
    this.activeHolds.set(keyIndex, nearestTime);
  }

  public handleKeyUp(e: KeyboardEvent) {
    const keyIndex = this.keyMap[e.code];
    if (keyIndex === undefined) return;

    const startTime = this.activeHolds.get(keyIndex);
    if (startTime == null) return;

    this.activeHolds.delete(keyIndex);

    const endTime = findNearestSnap(this.map, this.getCurrentTime(), this.snap);
    if (endTime == null) return;

    if (keyIndex === "sv") {
      const newSv: SvSegment = {
        startTime: Math.min(startTime, endTime),
        endTime: Math.max(startTime, endTime),
        pattern: "0", // Default pattern
      };
      const existingSv = this.map.svs.find((k) => k.startTime === newSv.startTime);
      if (existingSv) {
        const newSvs = this.map.svs.filter((sv) => sv !== existingSv);
        this.setMap({ ...this.map, svs: newSvs });
        return;
      }
      if (startTime === endTime) return; // no zero-length SVs
      const newSvs = [...this.map.svs, newSv].sort((a, b) => a.startTime - b.startTime);
      this.setMap({ ...this.map, svs: newSvs });
      return;
    }

    const newKey: Note = {
      startTime: Math.min(startTime, endTime),
      endTime: Math.max(startTime, endTime),
      key: keyIndex,
    };

    const existingNote = this.map.notes.find(
      (k) => k.startTime === newKey.startTime && k.key === newKey.key,
    );

    if (existingNote) {
      // Note exists, delete it.
      const newKeys = this.map.notes.filter((note) => note !== existingNote);
      this.setMap({ ...this.map, notes: newKeys });
    } else {
      // Note does not exist, add it.
      const newKeys = [...this.map.notes, newKey].sort((a, b) => a.startTime - b.startTime);
      this.setMap({ ...this.map, notes: newKeys });
    }
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
    ctx.strokeStyle = themeColors.border;
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

    // --- Draw SVs ---
    for (const sv of this.map.svs) {
      if (sv.endTime < viewStartTime || sv.startTime > viewEndTime) continue;
      // Default to linear if pattern is missing
      const pattern = this.map.svPatterns[sv.pattern] ?? { from: 0.5, to: 0.5 };

      const y_start = this.posToY(sv.startTime);
      const y_end = this.posToY(sv.endTime);

      const grad = ctx.createLinearGradient(0, y_start, 0, y_end);
      // Simple blue-to-red gradient for slow-to-fast
      const startSpeed = pattern.to / pattern.from;
      const endSpeed = (1 - pattern.to) / (1 - pattern.from);

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

      // Color based on speed multiplier (1x = white)
      const speedToColor = (speed: number) => {
        if (speed < 1) {
          // Blue for slower
          const t = clamp(speed, 0.25, 1);
          return `hsl(240, 100%, ${lerp(100, 75, t)}%)`;
        } else {
          // Red for faster
          const t = clamp((speed - 1) / 3, 0, 1); // up to 4x
          return `hsl(0, 100%, ${lerp(75, 50, t)}%)`;
        }
      };

      grad.addColorStop(0, speedToColor(startSpeed));
      grad.addColorStop(1, speedToColor(endSpeed));
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y_end, 10, y_start - y_end);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = "hsl(0, 0%, 50%)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y_end, 10, y_start - y_end);
    }

    const drawKey = (key: Note, isSelected: boolean) => {
      if (key.endTime < viewStartTime || key.startTime > viewEndTime) return;
      if (key.endTime < time - 0.0001) return; // make notes disappear as soon as they go past the line

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
          ctx.strokeStyle = themeColors.ring;
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
          ctx.strokeStyle = themeColors.ring;
          ctx.lineWidth = 4;
          ctx.strokeRect(x_start + 5, y_end, noteWidth, y_start - y_end);
        }
      }
    };

    const draggedOriginalKeys = this.dragContext?.type === "drag" ? this.dragContext.originalKeys : null;
    // --- Draw Keys ---
    for (const key of this.map.notes) {
      const keyId = key;
      if (draggedOriginalKeys?.has(keyId)) continue;
      drawKey(key, this.selectedKeyIds.has(keyId));
    }

    // --- Draw in-progress notes ---
    for (const [lane, startTime] of this.activeHolds.entries()) {
      if (typeof lane === "number") {
        drawKey(
          {
            startTime,
            endTime: findNearestSnap(this.map, time, this.snap) ?? time,
            key: lane as Note["key"],
          },
          false,
        );
      }
    }

    // --- Draw Dragged Keys Preview ---
    if (this.dragContext?.type === "drag") {
      for (const key of this.dragContext.newKeys) {
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
          ctx.strokeStyle = themeColors.ring;
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
          ctx.strokeStyle = themeColors.ring;
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
      ctx.fillStyle = themeColors.ringTransparent;
      ctx.strokeStyle = themeColors.ring;
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

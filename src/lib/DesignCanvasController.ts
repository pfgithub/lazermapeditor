import type { MapElement, Beatmap, Keybinds, KeybindAction, SvSegment, MapElementKey } from "@/store";
import {
  calculateTimingPointsInRange,
  findNearestSnap,
  findNextSnap,
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
      originalKeys: Set<MapElement>;
      newKeys: Set<MapElement>;
    }
  | null;

type ClipboardNote = {
  relativeStartTime: number;
  relativeEndTime: number;
  key: MapElementKey;
};

export interface DesignCanvasControllerOptions {
  canvas: HTMLCanvasElement;
  map: Beatmap;
  getCurrentTime: () => number;
  snap: Snap;
  keybinds: Keybinds;
  setMap: (map: Beatmap) => void;
  onSelectionChange?: (sel: Set<MapElement>) => void;
}

const themeColors = {
  border: "hsl(217.2 32.6% 17.5%)",
  ring: "hsl(217.2 91.2% 59.8%)",
  ringTransparent: "hsla(217.2 91.2% 59.8% / 0.2)",
};

export class DesignCanvasController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: Beatmap;
  private getCurrentTime: () => number;
  private snap: Snap;
  private keybinds: Keybinds;
  private keyMap: { [code: string]: MapElementKey };

  private setMap: (map: Beatmap) => void;
  private onSelectionChange: (sel: Set<MapElement>) => void;

  private dragContext: DragContext = null;

  activeHolds: Map<MapElementKey, number> = new Map();
  selectedElements: Set<MapElement> = new Set();
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

  private generateKeyMap(keybinds: Keybinds): { [code: string]: MapElementKey } {
    const keyMap: { [code: string]: MapElementKey } = {};
    const actions: KeybindAction[] = ["placeNoteLane1", "placeNoteLane2", "placeNoteLane3", "placeNoteLane4"];
    actions.forEach((action, index) => {
      (keybinds[action] || []).forEach((key) => {
        if (key) keyMap[key] = index as MapElementKey;
      });
    });
    for(const k of keybinds["placeSV"] ?? []) {
      if(k) keyMap[k] = "sv";
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

  public getKeysInBox(x1: number, t1: number, x2: number, t2: number): MapElement[] {
    const y1 = this.posToY(t1);
    const y2 = this.posToY(t2);
    const rect = this.canvas.getBoundingClientRect();
    const numLanes = 4;
    const laneWidth = rect.width / numLanes;
    const boxLeft = Math.min(x1, x2);
    const boxRight = Math.max(x1, x2);
    const boxTop = Math.min(y1, y2);
    const boxBottom = Math.max(y1, y2);
    const selectedKeys: MapElement[] = [];

    for (const key of this.map.notes) {
      if (key.key === "sv") {
        const keyLeft = 0;
        const keyRight = 7;
        if (keyLeft > boxRight || keyRight < boxLeft) continue;
        const y_start = this.posToY(key.startTime);
        const y_end = this.posToY(key.endTime);
        if (y_end < boxBottom && y_start > boxTop) {
          selectedKeys.push(key);
        }
        continue;
      }
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
    const yTime = this.yToPos(y);

    const clickedKeys = this.getKeysInBox(x, yTime, x, yTime);
    const clickedKey = clickedKeys[0];
    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;

    if (clickedKey) {
      const isSelected = this.selectedElements.has(clickedKey);

      if (isMultiSelect) {
        if (isSelected) {
          this.selectedElements.delete(clickedKey);
        } else {
          this.selectedElements.add(clickedKey);
        }
      } else {
        if (!isSelected) {
          this.selectedElements.clear();
          this.selectedElements.add(clickedKey);
        }
      }

      // Only start a drag if we're not deselecting with a multi-select key.
      if (isMultiSelect && isSelected) {
        this.dragContext = null;
      } else {
        const keysToDrag = new Set<MapElement>();
        this.map.notes.forEach((k) => {
          if (this.selectedElements.has(k)) {
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
        this.selectedElements.clear();
      }
      const time = this.yToPos(y);
      this.dragContext = {
        type: "select",
        x1: x,
        t1: time,
      };
      this.selectionBox = { x1: x, t1: time, x2: x, t2: time };
    }
    this.onSelectionChange(this.selectedElements);
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

      let minKey: number | null = null;
      let maxKey: number | null = null;
      for(const entry of context.originalKeys) {
        if(typeof entry.key === "number" && (minKey == null || entry.key < minKey)) minKey = entry.key;
        if(typeof entry.key === "number" && (maxKey == null || entry.key > maxKey)) maxKey = entry.key;
      }
      minKey ??= 0;
      maxKey ??= 0;

      let adjustedLaneDelta = laneDelta;
      if (minKey + laneDelta < 0) {
        adjustedLaneDelta = -minKey;
      }
      if (maxKey + laneDelta >= numLanes) {
        adjustedLaneDelta = numLanes - 1 - maxKey;
      }

      const anchorNote = context.originalKeys.values().next().value as MapElement | undefined;
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
        const newKey: MapElementKey = originalKey.key === "sv" ? "sv" : (originalKey.key + adjustedLaneDelta) as MapElementKey;
        context.newKeys.add({
          ...originalKey,
          startTime: originalKey.startTime + timeDeltaToApply,
          endTime: originalKey.endTime + timeDeltaToApply,
          key: newKey,
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
            keyIdsInBox.forEach((id) => this.selectedElements.add(id));
          } else {
            this.selectedElements = keyIdsInBox;
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
      this.selectedElements = newSelectedKeyIds;
    }
    this.dragContext = null;
    this.onSelectionChange(this.selectedElements);
  }

  private async handleCopy() {
    if (this.selectedElements.size === 0) return;

    const selectedNotes = Array.from(this.selectedElements);
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

      const newNotes: MapElement[] = [];
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

        const newNote: MapElement = {
          key: clipboardNote.key as MapElement["key"],
          startTime: pasteTime + clipboardNote.relativeStartTime,
          endTime: pasteTime + clipboardNote.relativeEndTime,
        };
        newNotes.push(newNote);
      }

      // Deselect old notes
      this.selectedElements.clear();

      // Add new notes to map
      const updatedNotes = [...this.map.notes, ...newNotes].sort((a, b) => a.startTime - b.startTime);
      this.setMap({ ...this.map, notes: updatedNotes });

      // Select the new notes.
      newNotes.forEach((note) => this.selectedElements.add(note));
      this.onSelectionChange(this.selectedElements);
    } catch (err) {
      console.warn("Failed to paste notes from clipboard:", err);
    }
  }

  private handleDelete() {
    if (this.selectedElements.size === 0) return;

    const newKeys = this.map.notes.filter((key) => !this.selectedElements.has(key));

    this.setMap({ ...this.map, notes: newKeys });
    this.selectedElements.clear();
    this.onSelectionChange(this.selectedElements);
  }

  public flipHorizontal() {
    if (this.selectedElements.size === 0) return;

    const newFlippedNotes: MapElement[] = [];
    const selectedNotes = this.selectedElements;

    for (const note of selectedNotes) {
      const newNote: MapElement = {
        ...note,
        key: note.key === "sv" ? note.key : (3 - note.key) as MapElement["key"],
      };
      newFlippedNotes.push(newNote);
    }

    const unselectedNotes = this.map.notes.filter((note) => !selectedNotes.has(note));

    const allNotes = [...unselectedNotes, ...newFlippedNotes].sort((a, b) => a.startTime - b.startTime);

    this.setMap({ ...this.map, notes: allNotes });

    this.selectedElements = new Set(newFlippedNotes);
    this.onSelectionChange(this.selectedElements);
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
      if (this.selectedElements.size > 0) {
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

    const newKey: MapElement = {
      startTime: Math.min(startTime, endTime),
      endTime: Math.max(startTime, endTime),
      key: keyIndex,
    };

    const existingNote = this.map.notes.find(
      (k) => k.startTime === newKey.startTime && k.key === newKey.key,
    );

    if (existingNote) {
      // Note exists, delete it.
      const newKeys = this.map.notes.filter(note => note !== existingNote);
      this.setMap({ ...this.map, notes: newKeys });
    } else {
      // Note does not exist, add it.
      if (newKey.key === "sv" && newKey.startTime === newKey.endTime) {
        const newEndTime = findNextSnap(this.map, newKey.endTime, this.snap);
        if (newEndTime == null) return;
        newKey.endTime = newEndTime;
      }
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

    const drawSv = (sv: MapElement, isSelected: boolean) => {
      const pattern = this.map.svPatterns[sv.svPattern ?? ""] ?? {from: 0.9, to: 0.1};

      const y_start = this.posToY(sv.startTime);
      const y_mid = this.posToY(sv.startTime + (sv.endTime - sv.startTime) * pattern.to);
      const y_end = this.posToY(sv.endTime);

      const c = 7;
      const c_before = c * pattern.to;
      const c_after = c * (1 - pattern.to);

      // Hold Note
      ctx.fillStyle = "#AAA";
      ctx.fillRect(0, y_end, c_before, y_mid - y_end);
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, y_mid, c_after, y_start - y_mid);
      
      if (isSelected) {
        ctx.strokeStyle = themeColors.ring;
        ctx.lineWidth = 2;
        ctx.strokeRect(0, y_end, c, y_start - y_end);
      }
    };

    const drawKey = (key: MapElement, isSelected: boolean) => {
      if (key.endTime < viewStartTime || key.startTime > viewEndTime) return;
      if (key.key === "sv") {
        return drawSv(key, isSelected);
      }
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
      drawKey(key, this.selectedElements.has(keyId));
    }

    // --- Draw in-progress notes ---
    for (const [lane, startTime] of this.activeHolds.entries()) {
      drawKey({
        startTime,
        endTime: findNearestSnap(this.map, time, this.snap) ?? time,
        key: +lane as MapElement["key"],
      }, false);
    }

    // --- Draw Dragged Keys Preview ---
    if (this.dragContext?.type === "drag") {
      for (const key of this.dragContext.newKeys) {
        drawKey(key, true);
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

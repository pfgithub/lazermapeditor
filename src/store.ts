import { create } from "zustand";
import { getMap, saveMap, getSongFile, saveSongFile, clearSongFile, getSettings, saveSettings } from "./db";

// Types
export type TimingSegment = {
  id: string;
  startTime: number;
  bpm: number;
};

export type SvSegment = {
  startTime: number;
  endTime: number;
  pattern: string,
};

export type SvPattern = {
  name: string;
  from: number,
  to: number,
};

export type MapElementKey = 0 | 1 | 2 | 3 | "sv";
export type MapElement = {
  startTime: number;
  endTime: number;
  key: MapElementKey;
  svPattern?: string;
};

export type Beatmap = {
  title: string;
  artist: string;
  creator: string;
  version: string;
  timing: TimingSegment[]; // sorted by start time
  notes: MapElement[]; // sorted by time
  svPatterns: Record<string, SvPattern>;
};

export type Song = {
  bytes: Uint8Array;
  name: string;
};

export type KeybindAction =
  | "temporaryPlay"
  | "seekBackward"
  | "seekForward"
  | "deleteSelection"
  | "placeNoteLane1"
  | "placeNoteLane2"
  | "placeNoteLane3"
  | "placeNoteLane4"
  | "placeSV";

export type Keybinds = Record<KeybindAction, string[]>; // Maps action to KeyboardEvent['code'] array

interface AppState {
  map: Beatmap;
  song: Song | null;
  isInitialized: boolean;
  keybinds: Keybinds;
  setMap: (map: Beatmap) => void;
  setSongFile: (songFile: File | null) => void;
  setKeybind: (action: KeybindAction, key: string, index: number) => void;
  loadFromDb: () => Promise<void>;
}

export const defaultMap: Beatmap = {
  title: "Untitled",
  artist: "Unknown Artist",
  creator: "New Mapper",
  version: "Normal",
  timing: [],
  notes: [],
  svPatterns: {},
};

const defaultKeybinds: Keybinds = {
  temporaryPlay: ["Space"],
  seekBackward: ["KeyA", "KeyL"],
  seekForward: ["KeyS", "Semicolon"],
  deleteSelection: ["Delete", "Backspace"],
  placeNoteLane1: ["KeyD"],
  placeNoteLane2: ["KeyF"],
  placeNoteLane3: ["KeyJ", "KeyG"],
  placeNoteLane4: ["KeyK", "KeyH"],
  placeSV: ["KeyT"],
};

export const useAppStore = create<AppState>((set, get) => ({
  map: defaultMap,
  song: null,
  isInitialized: false,
  keybinds: defaultKeybinds,

  setMap: (newMap) => {
    set({ map: newMap });
    saveMap(newMap).catch((err) => console.error("Failed to save map", err));
  },

  setKeybind: (action, key, index) => {
    const newKeybinds = { ...get().keybinds };
    const currentKeys = newKeybinds[action] ? [...newKeybinds[action]] : [];
    while (currentKeys.length <= index) {
      currentKeys.push("");
    }
    currentKeys[index] = key;
    newKeybinds[action] = currentKeys;

    set({ keybinds: newKeybinds });
    saveSettings(newKeybinds).catch((err) => console.error("Failed to save keybinds", err));
  },

  setSongFile: (songFile) => {
    if (songFile) {
      songFile.arrayBuffer().then((buffer) => {
        const newSong: Song = {
          bytes: new Uint8Array(buffer),
          name: songFile.name,
        };
        set({ song: newSong });
        saveSongFile(newSong).catch((err) => console.error("Failed to save song", err));
      });
    } else {
      set({ song: null });
      clearSongFile().catch((err) => console.error("Failed to clear song", err));
    }
  },

  loadFromDb: async () => {
    if (get().isInitialized) return;
    try {
      const [mapData, songData, keybindsData] = await Promise.all([
        getMap<Beatmap>(),
        getSongFile(),
        getSettings<Keybinds>(),
      ]);

      if (mapData) {
        // Ensure all fields are present from older saved versions
        set({ map: { ...defaultMap, ...mapData } });
      }
      if (songData) {
        // Handle migration from old format (File/Blob) to new format ({ bytes, name })
        if (songData instanceof Blob) {
          get().setSongFile(songData as File);
        } else {
          set({ song: songData as Song });
        }
      }
      if (keybindsData) {
        // Migration for users with old string-based keybinds
        const migratedKeybinds: Partial<Keybinds> = {};
        for (const key in keybindsData) {
          const action = key as KeybindAction;
          const value = (keybindsData as any)[action];
          if (typeof value === "string") {
            migratedKeybinds[action] = [value];
          } else if (Array.isArray(value)) {
            migratedKeybinds[action] = value;
          }
        }
        set({ keybinds: { ...defaultKeybinds, ...migratedKeybinds } });
      }
    } catch (error) {
      console.error("Failed to load data from IndexedDB", error);
    } finally {
      set({ isInitialized: true });
    }
  },
}));

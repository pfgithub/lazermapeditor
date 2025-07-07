import { create } from "zustand";
import { getMap, saveMap, getSongFile, saveSongFile, clearSongFile } from "./db";

// Types
export type TimingSegment = {
  id: string;
  startTime: number;
  bpm: number;
};

export type Key = {
  time: number;
  key: 0 | 1 | 2 | 3;
};

export type Map = {
  timing: TimingSegment[]; // sorted by start time
  keys: Key[]; // sorted by time
};

export type Song = {
  url: string;
  name: string;
};

interface AppState {
  map: Map;
  song: Song | null;
  isInitialized: boolean;
  setMap: (map: Map) => void;
  setSongFile: (songFile: File | null) => void;
  loadFromDb: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  map: { timing: [], keys: [] },
  song: null,
  isInitialized: false,

  setMap: (newMap) => {
    set({ map: newMap });
    saveMap(newMap).catch((err) => console.error("Failed to save map", err));
  },

  setSongFile: (songFile) => {
    // Revoke old URL to prevent memory leaks
    const oldUrl = get().song?.url;
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    if (songFile) {
      set({
        song: {
          url: URL.createObjectURL(songFile),
          name: songFile.name,
        },
      });
      saveSongFile(songFile).catch((err) => console.error("Failed to save song", err));
    } else {
      set({ song: null });
      clearSongFile().catch((err) => console.error("Failed to clear song", err));
    }
  },

  loadFromDb: async () => {
    if (get().isInitialized) return;
    try {
      const [mapData, songFile] = await Promise.all([getMap<Map>(), getSongFile()]);
      if (mapData) {
        if (!mapData.keys) {
          mapData.keys = [];
        }
        set({ map: mapData });
      }
      if (songFile) {
        // Use setSongFile to avoid duplicating logic and handle URL creation
        get().setSongFile(songFile);
      }
    } catch (error) {
      console.error("Failed to load data from IndexedDB", error);
    } finally {
      set({ isInitialized: true });
    }
  },
}));

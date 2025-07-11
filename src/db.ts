import type { Song } from "./store";

const DB_NAME = "rhythm-editor-db";
const DB_VERSION = 2;
const MAP_STORE_NAME = "map";
const SONG_STORE_NAME = "song";
const SETTINGS_STORE_NAME = "settings";

let db: IDBDatabase;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject("IndexedDB error");
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MAP_STORE_NAME)) {
        db.createObjectStore(MAP_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SONG_STORE_NAME)) {
        db.createObjectStore(SONG_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME);
      }
    };
  });
}

// Map data persistence
export async function getMap<T>(): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MAP_STORE_NAME, "readonly");
    const store = transaction.objectStore(MAP_STORE_NAME);
    const request = store.get("currentMap");
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMap(mapData: unknown): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(MAP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(MAP_STORE_NAME);
    const request = store.put(mapData, "currentMap");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Song file persistence
export async function getSongFile(): Promise<Song | File | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SONG_STORE_NAME, "readonly");
    const store = transaction.objectStore(SONG_STORE_NAME);
    const request = store.get("currentSong");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSongFile(song: Song): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SONG_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SONG_STORE_NAME);
    const request = store.put(song, "currentSong");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSongFile(): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SONG_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SONG_STORE_NAME);
    const request = store.delete("currentSong");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Settings persistence
export async function getSettings<T>(): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readonly");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.get("keybinds");
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSettings(settingsData: unknown): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.put(settingsData, "keybinds");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

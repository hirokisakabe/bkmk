import { useCallback, useSyncExternalStore } from 'react';

const DB_NAME = 'bkmk-settings';
const STORE_NAME = 'settings';
const DB_VERSION = 1;

interface Settings {
  includeSubfolders: boolean;
}

const defaultSettings: Settings = {
  includeSubfolders: false,
};

let cachedSettings: Settings = { ...defaultSettings };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadSettings(): Promise<Settings> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('settings');
    request.onsuccess = () => {
      const value = request.result as Settings | undefined;
      resolve(value ?? { ...defaultSettings });
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveSettings(settings: Settings): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(settings, 'settings');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

let initialized = false;

function initIfNeeded() {
  if (initialized) return;
  initialized = true;
  if (typeof indexedDB === 'undefined') return;
  loadSettings()
    .then((settings) => {
      cachedSettings = settings;
      notify();
    })
    .catch(() => {
      // IndexedDB unavailable — keep defaults
    });
}

export function useSettings(): [Settings, (update: Partial<Settings>) => void] {
  initIfNeeded();

  const settings = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cachedSettings,
  );

  const updateSettings = useCallback((update: Partial<Settings>) => {
    cachedSettings = { ...cachedSettings, ...update };
    notify();
    saveSettings(cachedSettings).catch(() => {
      // IndexedDB write failed — in-memory state is still updated
    });
  }, []);

  return [settings, updateSettings];
}

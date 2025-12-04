import { GeneratedImage, FailedJob } from '../types';

const DB_NAME = 'SonyMacroDB';
const STORE_IMAGES = 'images';
const STORE_FAILED = 'failed_jobs';
const DB_VERSION = 2; // Bump version to add new store

// Helper to open the database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Check if indexedDB is supported
    if (!window.indexedDB) {
      reject("IndexedDB not supported");
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create images store if not exists
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }

      // Create failed jobs store if not exists
      if (!db.objectStoreNames.contains(STORE_FAILED)) {
        db.createObjectStore(STORE_FAILED, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- IMAGES OPERATIONS ---

export const saveImageToDB = async (image: GeneratedImage): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const request = store.put(image);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to save to DB:", e);
  }
};

export const getImagesFromDB = async (): Promise<GeneratedImage[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readonly');
      const store = tx.objectStore(STORE_IMAGES);
      const request = store.getAll();
      request.onsuccess = () => {
          const results = request.result as GeneratedImage[];
          // Sort by timestamp desc (newest first)
          results.sort((a, b) => b.timestamp - a.timestamp);
          resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to fetch from DB:", e);
    return [];
  }
};

export const deleteImageFromDB = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to delete from DB:", e);
  }
};

export const clearImagesFromDB = async (): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to clear DB:", e);
  }
};

// --- FAILED JOBS OPERATIONS ---

export const saveFailedJobToDB = async (job: FailedJob): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readwrite');
      const store = tx.objectStore(STORE_FAILED);
      const request = store.put(job);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to save failed job:", e);
  }
};

export const getFailedJobsFromDB = async (): Promise<FailedJob[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readonly');
      const store = tx.objectStore(STORE_FAILED);
      const request = store.getAll();
      request.onsuccess = () => {
          const results = request.result as FailedJob[];
          results.sort((a, b) => b.timestamp - a.timestamp);
          resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to fetch failed jobs:", e);
    return [];
  }
};

export const deleteFailedJobFromDB = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readwrite');
      const store = tx.objectStore(STORE_FAILED);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to delete failed job:", e);
  }
};

export const clearFailedJobsFromDB = async (): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readwrite');
      const store = tx.objectStore(STORE_FAILED);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to clear failed jobs:", e);
  }
};
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'blox-compare-ids';
export const COMPARE_MAX = 3;

export type CompareEntry = { id: string; slug: string };

function readStorage(): CompareEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function writeStorage(entries: CompareEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, COMPARE_MAX)));
  window.dispatchEvent(new CustomEvent('blox-compare-change'));
}

export function useCompareStore() {
  const [entries, setEntries] = useState<CompareEntry[]>(() =>
    typeof window !== 'undefined' ? readStorage() : [],
  );

  useEffect(() => {
    function sync() {
      setEntries(readStorage());
    }
    window.addEventListener('blox-compare-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('blox-compare-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isCompared = useCallback(
    (id: string) => entries.some((e) => e.id === id),
    [entries],
  );

  const toggle = useCallback((entry: CompareEntry) => {
    const current = readStorage();
    const exists = current.find((e) => e.id === entry.id);
    if (exists) {
      writeStorage(current.filter((e) => e.id !== entry.id));
    } else if (current.length >= COMPARE_MAX) {
      writeStorage([...current.slice(1), entry]);
    } else {
      writeStorage([...current, entry]);
    }
    setEntries(readStorage());
  }, []);

  const remove = useCallback((id: string) => {
    writeStorage(readStorage().filter((e) => e.id !== id));
    setEntries(readStorage());
  }, []);

  const clear = useCallback(() => {
    writeStorage([]);
    setEntries([]);
  }, []);

  return { entries, count: entries.length, isCompared, toggle, remove, clear };
}

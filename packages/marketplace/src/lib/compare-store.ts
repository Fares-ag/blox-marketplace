import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@drivemarket/shared';

const STORAGE_PREFIX = 'blox-compare-ids';
export const COMPARE_MAX = 3;

export type CompareEntry = { id: string; slug: string };

/** Scope the compare list per account so two people on the same device never
 * see each other's selection; signed-out browsing uses an `anon` bucket. */
function storageKey(accountId: string | null | undefined): string {
  return `${STORAGE_PREFIX}:${accountId ?? 'anon'}`;
}

function readStorage(key: string): CompareEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, entries: CompareEntry[]) {
  localStorage.setItem(key, JSON.stringify(entries.slice(0, COMPARE_MAX)));
  window.dispatchEvent(new CustomEvent('blox-compare-change'));
}

export function useCompareStore() {
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const key = useMemo(() => storageKey(accountId), [accountId]);
  const [entries, setEntries] = useState<CompareEntry[]>(() =>
    typeof window !== 'undefined' ? readStorage(key) : [],
  );

  // Re-read whenever the account (and therefore the key) changes.
  useEffect(() => {
    setEntries(readStorage(key));
  }, [key]);

  useEffect(() => {
    function sync() {
      setEntries(readStorage(key));
    }
    window.addEventListener('blox-compare-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('blox-compare-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [key]);

  const isCompared = useCallback(
    (id: string) => entries.some((e) => e.id === id),
    [entries],
  );

  const toggle = useCallback(
    (entry: CompareEntry) => {
      const current = readStorage(key);
      const exists = current.find((e) => e.id === entry.id);
      if (exists) {
        writeStorage(key, current.filter((e) => e.id !== entry.id));
      } else if (current.length >= COMPARE_MAX) {
        writeStorage(key, [...current.slice(1), entry]);
      } else {
        writeStorage(key, [...current, entry]);
      }
      setEntries(readStorage(key));
    },
    [key],
  );

  const remove = useCallback(
    (id: string) => {
      writeStorage(key, readStorage(key).filter((e) => e.id !== id));
      setEntries(readStorage(key));
    },
    [key],
  );

  const clear = useCallback(() => {
    writeStorage(key, []);
    setEntries([]);
  }, [key]);

  return { entries, count: entries.length, isCompared, toggle, remove, clear };
}

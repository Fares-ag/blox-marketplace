import { useRef, type DragEvent, type ReactNode } from 'react';
import { apiFileUrl } from '../lib/api';

type Props = {
  filePath: string;
  filename: string;
  className?: string;
  children: ReactNode;
};

function fileType(blob: Blob, filename: string): string {
  if (blob.type && blob.type !== 'application/octet-stream') return blob.type;
  if (filename.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  return blob.type || 'application/octet-stream';
}

/** Prefetch on pointer down so dragstart can attach the file synchronously. */
export function DraggableApiFile({ filePath, filename, className, children }: Props) {
  const fileRef = useRef<File | null>(null);
  const pending = useRef<Promise<File | null> | null>(null);

  function load() {
    if (fileRef.current) return;
    if (pending.current) return;
    const base = apiFileUrl(filePath);
    const url = `${base}${base.includes('?') ? '&' : '?'}disposition=attachment`;
    pending.current = fetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null;
        const blob = await res.blob();
        const type = fileType(blob, filename);
        const file = new File([blob], filename, { type });
        fileRef.current = file;
        return file;
      })
      .catch(() => null);
  }

  function onDragStart(event: DragEvent) {
    const file = fileRef.current;
    if (!file) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    try {
      event.dataTransfer.items.add(file);
    } catch {
      /* items.add is unsupported in some browsers */
    }
    const objectUrl = URL.createObjectURL(file);
    event.dataTransfer.setData('DownloadURL', `${file.type}:${file.name}:${objectUrl}`);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  return (
    <div className={className} draggable onPointerDown={load} onDragStart={onDragStart}>
      {children}
    </div>
  );
}

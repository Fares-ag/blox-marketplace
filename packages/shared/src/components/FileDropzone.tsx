import { useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';

type FileDropzoneProps = {
  accept?: string;
  disabled?: boolean;
  hiddenInput?: boolean;
  className?: string;
  children: ReactNode;
  onFile: (file: File) => void;
};

/** Click-or-drop file picker used by ops and customer upload surfaces. */
export function FileDropzone({
  accept,
  disabled,
  hiddenInput = true,
  className,
  children,
  onFile,
}: FileDropzoneProps) {
  const [over, setOver] = useState(false);

  function take(file: File | undefined) {
    if (!file || disabled) return;
    onFile(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    take(e.target.files?.[0]);
    e.target.value = '';
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled) setOver(true);
  }

  function onDragLeave() {
    setOver(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  }

  return (
    <label
      className={`${className ?? ''} ${over ? 'is-drop-over' : ''}`.trim()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      <input type="file" accept={accept} hidden={hiddenInput} disabled={disabled} onChange={onChange} />
    </label>
  );
}

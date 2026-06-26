/** Переиспользуемая зона загрузки файла с Drag & Drop. */

import { useRef, useState } from 'react';
import { FileIcon, UploadIcon } from './icons';

interface Props {
  title: string;
  hint: string;
  accept: string;
  fileName?: string | null;
  loaded?: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
}

export default function DropZone({
  title,
  hint,
  accept,
  fileName,
  loaded,
  disabled,
  onFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (disabled) return;
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`dropzone${drag ? ' drag' : ''}${loaded ? ' loaded' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="dropzone-icon">
        <UploadIcon />
      </div>
      <h3>{title}</h3>
      <p>{hint}</p>
      {fileName && (
        <span className="file-pill">
          <FileIcon /> {fileName}
        </span>
      )}
    </div>
  );
}

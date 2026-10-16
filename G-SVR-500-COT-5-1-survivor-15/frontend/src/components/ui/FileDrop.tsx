import { useCallback, useState } from 'react';
import { cn } from '@/lib/cn';

const ACCEPT = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function FileDrop({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: File | null;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  const [over, setOver] = useState(false);

  const take = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      onChange(file);
    },
    [onChange],
  );

  return (
    <div>
      <p className="field-label">{label}</p>
      <label
        className={cn(
          'flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-line bg-grey px-4 text-center',
          over && 'border-forest bg-sageSoft',
          error && 'border-danger',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => take(e.target.files?.[0])}
        />
        {value ? (
          <div>
            <p className="font-bold">{value.name}</p>
            <p className="mt-1 text-[12.5px] text-muted">
              {(value.size / 1024 / 1024).toFixed(2)} Mo
              {!ACCEPT.includes(value.type) ? ' · type à vérifier' : ''}
            </p>
            <button
              type="button"
              className="mt-3 text-[13px] font-semibold underline"
              onClick={(e) => {
                e.preventDefault();
                onChange(null);
              }}
            >
              Supprimer
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            Glissez un PDF ou DOCX (5 Mo max) ou cliquez pour parcourir.
          </p>
        )}
      </label>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

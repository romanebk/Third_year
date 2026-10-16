import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, hint, className, ...props },
  ref,
) {
  const fid = id ?? props.name ?? 'field';
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint}>
      <input
        ref={ref}
        id={fid}
        className={cn('field-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...props}
      />
    </FieldShell>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { id, label, error, hint, className, ...props },
  ref,
) {
  const fid = id ?? props.name ?? 'field';
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint}>
      <textarea
        ref={ref}
        id={fid}
        className={cn('field-input min-h-[140px] resize-y', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...props}
      />
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, error, hint, className, children, ...props },
  ref,
) {
  const fid = id ?? props.name ?? 'field';
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        id={fid}
        className={cn('field-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

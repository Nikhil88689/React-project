import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { errorMessage, isApiError } from './api';

/** Maps a VALIDATION_ERROR response onto form fields; falls back to a toast. Returns true if mapped. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, opts: { toastFallback?: boolean } = { toastFallback: true }) {
  if (isApiError(err) && err.code === 'VALIDATION_ERROR') {
    const entries = Object.entries(err.fieldErrors);
    for (const [field, messages] of entries) setError(field as Path<T>, { type: 'server', message: messages[0] });
    if (entries.length) return true;
  }
  if (opts.toastFallback) toast.error(errorMessage(err));
  return false;
}

// @ts-nocheck
/**
 * 연습 데이터 검증 디버그 헬퍼 — 필드별 JSON 오류, Recoverable Error, console.table.
 */

export interface ValidationFieldError {
  missingField: string;
  expected: string;
  received: unknown;
  message?: string;
}

export interface RecoverableValidationError extends ValidationFieldError {
  recoverable: true;
  errorName: string;
  stack?: string;
}

export function buildFieldError(
  missingField: string,
  expected: string,
  received: unknown,
  message?: string,
): ValidationFieldError {
  return { missingField, expected, received, ...(message ? { message } : {}) };
}

export function buildRecoverableError(
  missingField: string,
  err: unknown,
  expected = 'valid value',
): RecoverableValidationError {
  const error = err as Error;
  return {
    missingField,
    expected,
    received: error?.message ?? err,
    recoverable: true,
    errorName: error?.name || 'ReferenceError',
    message: 'Recoverable Error — Validation 실패로 처리하지 않음',
    stack: error?.stack,
  };
}

/** Validation 실패 필드를 JSON 형태로 콘솔 출력 */
export function logValidationFieldErrors(
  label: string,
  errors: ValidationFieldError[],
) {
  if (!errors.length) return;

  console.group(`[Validation] ${label} — ${errors.length} blocking error(s)`);
  errors.forEach((entry, index) => {
    const payload = {
      missingField: entry.missingField,
      expected: entry.expected,
      received: entry.received,
      ...(entry.message ? { message: entry.message } : {}),
    };
    console.warn(`Blocking #${index + 1}: ${entry.missingField}`);
    console.log(JSON.stringify(payload, null, 2));
  });
  console.groupEnd();
}

/** ReferenceError 등 Recoverable Error — Validation 실패 아님 */
export function logRecoverableErrors(
  label: string,
  errors: RecoverableValidationError[],
) {
  if (!errors.length) return;

  console.group(`[Validation] ${label} — ${errors.length} recoverable error(s)`);
  errors.forEach((entry, index) => {
    const payload = {
      missingField: entry.missingField,
      expected: entry.expected,
      received: entry.received,
      recoverable: true,
      errorName: entry.errorName,
      message: entry.message,
    };
    console.warn(`Recoverable #${index + 1}: ${entry.missingField}`);
    console.log(JSON.stringify(payload, null, 2));
    if (entry.stack && import.meta.env?.DEV) {
      console.debug(entry.stack);
    }
  });
  console.groupEnd();
}

export function logUndefinedFields(
  label: string,
  obj: Record<string, unknown> | null | undefined,
  keys: string[],
): string[] {
  const missing = keys.filter((key) => {
    const value = obj?.[key];
    return value === undefined || value === null;
  });

  if (missing.length > 0) {
    const errors = missing.map((field) =>
      buildFieldError(
        field,
        'defined value',
        obj?.[field] ?? undefined,
        `${label}: required field missing`,
      ),
    );
    logValidationFieldErrors(label, errors);
  }

  return missing;
}

export function isReferenceError(err: unknown): boolean {
  if (err instanceof ReferenceError) return true;
  if (err && typeof err === 'object') {
    const name = (err as Error).name;
    const message = String((err as Error).message || '');
    if (name === 'ReferenceError') return true;
    if (/\bis not defined\b/i.test(message)) return true;
  }
  return false;
}

export function isRecoverableError(err: unknown): boolean {
  return isReferenceError(err);
}

export interface PracticeValidationTableRow {
  frameCount: number | string;
  timelineLength: number | string;
  memberCount: number | string;
  snapshot: string;
  video: string;
  motion: string;
  formation: string;
  metadata: string;
  confidence: string;
}

export function logPracticeValidationTable(
  row: PracticeValidationTableRow,
  extra: Record<string, unknown> = {},
) {
  console.group('[PracticeValidation] summary');
  console.table([{ ...row, ...extra }]);
  console.groupEnd();
}

export function formatReferenceVideoStatus(
  referenceVideo: Record<string, unknown> | null | undefined,
): string {
  if (!referenceVideo) return 'missing';
  const parts: string[] = [];
  if (referenceVideo.youtubeUrl) parts.push('youtubeUrl');
  if (referenceVideo.localPlaybackUrl) parts.push('localPlaybackUrl');
  if (referenceVideo.blobCacheKey) parts.push('blobCacheKey');
  if (referenceVideo.videoId) parts.push('videoId');
  return parts.length ? parts.join('+') : 'empty';
}

export default logValidationFieldErrors;

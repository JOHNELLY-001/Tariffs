export interface SplitWarning {
  code: string | null;
  message: string;
}

/**
 * Backend warnings use the form `CODE: human-readable message`. Split the code
 * for presentation only; the message text is never rewritten.
 */
export function splitWarning(warning: string): SplitWarning {
  const separator = warning.indexOf(':');
  if (separator <= 0) return { code: null, message: warning };

  const code = warning.slice(0, separator).trim();
  if (!/^[A-Z0-9_]+$/.test(code)) return { code: null, message: warning };

  return {
    code,
    message: warning.slice(separator + 1).trim(),
  };
}

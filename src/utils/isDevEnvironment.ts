/** Vite dev / NODE_ENV development — production 번들에서는 false */
export function isDevEnvironment(): boolean {
  const nodeEnv = typeof globalThis !== 'undefined'
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;
  if (nodeEnv?.K_ONNODE_ALLOW_DEV === '1') {
    return true;
  }
  return Boolean(import.meta.env?.DEV || import.meta.env?.MODE === 'development');
}

export default isDevEnvironment;

/** Vite dev / NODE_ENV development — production 번들에서는 false */
export function isDevEnvironment(): boolean {
  return Boolean(import.meta.env?.DEV || import.meta.env?.MODE === 'development');
}

export default isDevEnvironment;

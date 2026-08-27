/**
 * Make application source importable by the Node test runner.
 *
 * Next.js resolves the "@/" alias and extensionless imports through its own
 * bundler; node does neither, so without this hook nothing that imports
 * application code could be unit tested — which is why the data adapters
 * previously had no tests of their own.
 */
const SRC = new URL('../src/', import.meta.url).href;

/**
 * `server-only` is a build-time guard, not runtime behaviour: Next resolves it
 * to a module that fails the build if client code imports it. Node has no such
 * package, so without this stub anything marked server-only — including the
 * notification jobs — could not be tested at all, which is exactly backwards.
 */
const SERVER_ONLY = 'data:text/javascript,export {};';

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js'];

export async function resolve(specifier, context, next) {
  if (specifier === 'server-only' || specifier === 'client-only') {
    return { url: SERVER_ONLY, shortCircuit: true };
  }

  const target = specifier.startsWith('@/') ? SRC + specifier.slice(2) : specifier;
  try {
    return await next(target, context);
  } catch (error) {
    // authored without a file extension, the way the bundler allows
    for (const ext of EXTENSIONS) {
      try {
        return await next(target + ext, context);
      } catch {
        /* keep trying */
      }
    }
    throw error;
  }
}

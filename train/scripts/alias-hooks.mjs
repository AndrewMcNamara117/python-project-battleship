/**
 * Make application source importable by the Node test runner.
 *
 * Next.js resolves the "@/" alias and extensionless imports through its own
 * bundler; node does neither, so without this hook nothing that imports
 * application code could be unit tested — which is why the data adapters
 * previously had no tests of their own.
 */
const SRC = new URL('../src/', import.meta.url).href;
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js'];

export async function resolve(specifier, context, next) {
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

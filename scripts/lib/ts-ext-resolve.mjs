// ESM resolve hook for the ops scripts (data-rights, moderate-photo).
//
// WHY THIS EXISTS: the ops CLIs import the app's TypeScript modules directly
// (src/lib/*.ts) and run them under Node's native type-stripping, so there is
// exactly ONE copy of safety-critical logic (deletion, moderation) — never a
// second .mjs re-implementation to drift. But the app source uses EXTENSIONLESS
// relative imports (`import … from './data-rights'`), the Astro/bundler
// convention the rest of the codebase follows. Node's ESM resolver requires a
// file extension and does NOT map `./data-rights` → `./data-rights.ts`, so a
// .ts module that imports a sibling .ts module fails with ERR_MODULE_NOT_FOUND.
//
// This hook closes that gap for ops runs only: when a relative specifier has no
// extension, try resolving it as `.ts` first, then fall back. It changes NOTHING
// about how the app builds or how vitest/astro resolve (they use bundler
// resolution already) — it exists purely so `node scripts/*.mjs` can load the
// real typed modules.
//
// Registered via node:module `register()` at the top of each ops script.
import { register } from 'node:module';

const RELATIVE = /^\.\.?\//;
const HAS_EXT = /\.[cm]?[jt]sx?$|\.json$/i;

export async function resolve(specifier, context, nextResolve) {
  if (RELATIVE.test(specifier) && !HAS_EXT.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      // fall through to the default resolution + error below
    }
  }
  return nextResolve(specifier, context);
}

// Convenience: `import { registerTsExtResolve } from './lib/ts-ext-resolve.mjs'`
// then call it before dynamically importing any .ts module.
export function registerTsExtResolve() {
  register('./ts-ext-resolve.mjs', import.meta.url);
}

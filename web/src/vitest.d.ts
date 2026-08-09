import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// @testing-library/jest-dom@7's own `types/vitest.d.ts` augments `declare module "vitest"`,
// which matched vitest's Assertion type through v3. In vitest v4 that interface moved to
// `@vitest/expect`, so we re-declare the augmentation against the new location here.
declare module "@vitest/expect" {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}

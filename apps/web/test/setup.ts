import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without this, each render() leaves its DOM in place for the next test (we don't use
// vitest's `globals: true`, so @testing-library/react's automatic jest-only cleanup never
// registers) — two tests that each render the placeholder text then both "find" it,
// doubled, and the second test fails with a false "multiple elements" error.
afterEach(() => {
  cleanup();
});

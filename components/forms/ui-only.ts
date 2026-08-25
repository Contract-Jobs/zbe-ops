import type { FormEvent } from "react";

/** Forms close only. Replace with a React Query mutation later. */
export function uiOnly(event: FormEvent, done: () => void) {
  event.preventDefault();
  done();
}

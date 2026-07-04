import type { Clock } from "../ports/clock.ts";

export function createSystemClock(): Clock {
  return {
    now: () => new Date(),
  };
}

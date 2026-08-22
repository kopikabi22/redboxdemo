import { describe, expect, it } from 'vitest';
import { nowIso } from './storage';

describe('nowIso', () => {
  it('is strictly increasing even across many synchronous calls with no delay between them', () => {
    const timestamps: string[] = [];
    for (let i = 0; i < 100; i++) {
      timestamps.push(nowIso());
    }

    // String comparison (this is how computeExpectedBreakdown's window
    // bounds actually compare timestamps in production).
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] > timestamps[i - 1]).toBe(true);
    }

    // Same assertion again via actual Date arithmetic, so this doesn't
    // just prove ISO strings sort lexicographically — it proves the
    // underlying instants are truly increasing.
    for (let i = 1; i < timestamps.length; i++) {
      expect(new Date(timestamps[i]).getTime()).toBeGreaterThan(new Date(timestamps[i - 1]).getTime());
    }

    // No duplicates anywhere in the run, as a direct restatement of "strict".
    expect(new Set(timestamps).size).toBe(timestamps.length);
  });

  it('returns a valid, round-trippable ISO timestamp close to real wall-clock time — not an arbitrary number', () => {
    const before = Date.now();
    const iso = nowIso();
    const after = Date.now();

    const parsed = new Date(iso);
    expect(parsed.toString()).not.toBe('Invalid Date');
    // Re-serializing the parsed Date must reproduce the exact same string —
    // proves it's a genuine ISO 8601 timestamp, not a lookalike string.
    expect(parsed.toISOString()).toBe(iso);

    // Never behind real time (the monotonic nudge only ever pushes forward).
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
    // Allow generous headroom for monotonic drift carried over from the
    // rapid-fire test above (each collision nudges forward by 1ms), but it
    // must still land within a second of "now" — proving this is real
    // wall-clock time, not a runaway or unrelated value.
    expect(parsed.getTime()).toBeLessThan(after + 1000);
  });
});

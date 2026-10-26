import { describe, expect, test } from "vitest";
import { isKnownPlace, normalizeState } from "../../src/lib/places";

describe("one spelling per state", () => {
  test("abbreviations, case and stray spaces all become the full name", () => {
    expect(normalizeState("NY")).toBe("New York");
    expect(normalizeState(" new  york ")).toBe("New York");
    expect(normalizeState("N.Y.")).toBe("New York");
    expect(normalizeState("ga")).toBe("Georgia");
    expect(normalizeState("Washington DC")).toBe("District of Columbia");
  });

  test("places outside the US", () => {
    expect(normalizeState("jamaica")).toBe("Jamaica");
    expect(normalizeState("UK")).toBe("United Kingdom");
  });

  test("blank is empty, and unknown values are kept (tidied), never lost", () => {
    expect(normalizeState("  ")).toBeNull();
    expect(normalizeState(null)).toBeNull();
    expect(normalizeState("  Ontario ")).toBe("Ontario");
  });

  test("dropdown values are recognised exactly", () => {
    expect(isKnownPlace("New York")).toBe(true);
    expect(isKnownPlace("NY")).toBe(false);
    expect(isKnownPlace("Jamaica")).toBe(true);
  });
});

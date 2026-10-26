import { describe, expect, test } from "vitest";
import { splitInterests } from "../../src/lib/interests";

describe("adding several interests at once", () => {
  test("splits at commas, semicolons and line breaks", () => {
    expect(splitInterests("hiking, biking on the boardwalk, gardening, cooking, walking the dog")).toEqual([
      "Hiking",
      "Biking on the boardwalk",
      "Gardening",
      "Cooking",
      "Walking the dog",
    ]);
    expect(splitInterests("Reading; travel\nbaking")).toEqual(["Reading", "Travel", "Baking"]);
  });

  test("keeps 'and' inside an interest, and drops blanks and duplicates", () => {
    expect(splitInterests("Arts and crafts, , arts and crafts ,  Rock  and roll")).toEqual(["Arts and crafts", "Rock and roll"]);
    expect(splitInterests("   ")).toEqual([]);
  });
});

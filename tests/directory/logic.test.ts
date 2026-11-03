import { describe, expect, test } from "vitest";
import {
  filterHref,
  filterPeople,
  initials,
  newestFirst,
  readFilters,
  tally,
  upcomingBirthdays,
  websiteHref,
  type Person,
} from "../../src/lib/directory-logic";

function person(overrides: Partial<Person>): Person {
  return {
    id: overrides.fullName ?? "id",
    fullName: "Test Person",
    aka: null,
    isChild: false,
    isClaimed: false,
    isMe: false,
    canEdit: false,
    city: null,
    state: null,
    birthMonth: null,
    birthDay: null,
    birthYear: null,
    photoUrl: null,
    primaryBranch: null,
    branches: [],
    hobbies: [],
    contactEmail: null,
    phone: null,
    instagram: null,
    linkedin: null,
    website: null,
    ...overrides,
  };
}

const garden = { slug: "gardening", name: "Gardening" };
const branchA = { slug: "branch-a", name: "Branch A" };
const people = [
  person({ fullName: "Pat Example", aka: "Patty", city: "Reno", state: "Nevada", branches: [branchA], hobbies: [garden], birthMonth: 9 }),
  person({ fullName: "José Sample", city: "Atlanta", state: "Georgia", hobbies: [garden], birthMonth: 12 }),
  person({ fullName: "Sam Other", city: "Reno", state: "Nevada", branches: [branchA] }),
];
const none = readFilters({});

describe("searching and filtering", () => {
  test("search matches full name or nickname, any case, ignoring accents", () => {
    expect(filterPeople(people, { ...none, q: "patty" }).map((p) => p.fullName)).toEqual(["Pat Example"]);
    expect(filterPeople(people, { ...none, q: "jose" }).map((p) => p.fullName)).toEqual(["José Sample"]);
    expect(filterPeople(people, { ...none, q: "pat exa" }).map((p) => p.fullName)).toEqual(["Pat Example"]);
    expect(filterPeople(people, { ...none, q: "nobody" })).toEqual([]);
  });

  test("filters combine", () => {
    expect(filterPeople(people, { ...none, branch: "branch-a" })).toHaveLength(2);
    expect(filterPeople(people, { ...none, branch: "branch-a", hobby: "gardening" }).map((p) => p.fullName)).toEqual([
      "Pat Example",
    ]);
    expect(filterPeople(people, { ...none, state: "Nevada", city: "Reno" })).toHaveLength(2);
    expect(filterPeople(people, { ...none, month: "12" }).map((p) => p.fullName)).toEqual(["José Sample"]);
  });

  test("reads only the first value of each filter and trims the search", () => {
    expect(readFilters({ q: "  pat ", branch: ["a", "b"] })).toMatchObject({ q: "pat", branch: "a" });
  });

  test("filter links keep the other filters", () => {
    expect(filterHref({ ...none, branch: "branch-a" }, { hobby: "gardening" })).toBe("/family?branch=branch-a&hobby=gardening");
    expect(filterHref({ ...none, branch: "branch-a" }, { branch: "" })).toBe("/family");
  });

  test("counts for browsing, most common first", () => {
    expect(tally(people.flatMap((p) => p.hobbies))).toEqual([{ slug: "gardening", name: "Gardening", count: 2 }]);
  });
});

describe("upcoming birthdays", () => {
  const today = new Date(Date.UTC(2026, 11, 20)); // December 20
  const folks = [
    person({ fullName: "Today", birthMonth: 12, birthDay: 20, birthYear: 1980 }),
    person({ fullName: "New Year", birthMonth: 1, birthDay: 2 }),
    person({ fullName: "Far", birthMonth: 3, birthDay: 1 }),
    person({ fullName: "Yesterday", birthMonth: 12, birthDay: 19 }),
  ];

  test("includes today and wraps into next year, soonest first", () => {
    const result = upcomingBirthdays(folks, today);
    expect(result.map((r) => [r.person.fullName, r.daysAway, r.turning])).toEqual([
      ["Today", 0, 46],
      ["New Year", 13, null],
    ]);
  });

  test("a Feb 29 birthday is celebrated on Feb 28 in other years", () => {
    const leapling = [person({ fullName: "Leap", birthMonth: 2, birthDay: 29 })];
    expect(upcomingBirthdays(leapling, new Date(Date.UTC(2027, 1, 27)))[0].daysAway).toBe(1);
  });
});

describe("labels and links", () => {
  test("initials", () => {
    expect(initials("Verena Bryan")).toBe("VB");
    expect(initials("Asher Bryan-Campbell")).toBe("AB");
    expect(initials("Cher")).toBe("C");
  });

  test("website links are only http or https", () => {
    expect(websiteHref("example.com")).toBe("https://example.com/");
    expect(websiteHref("javascript:alert(1)")).toBeNull();
  });
});

describe("child labels", () => {
  test("names the recorded parents, or just says Child", async () => {
    const { childOfLabel } = await import("../../src/lib/directory-logic");
    expect(childOfLabel([{ name: "Vanessa Bryan" }])).toBe("Vanessa Bryan's child");
    expect(childOfLabel([{ name: "Pat Example" }, { name: "Sam Example" }])).toBe("Pat Example and Sam Example's child");
    expect(childOfLabel([])).toBe("Child");
    expect(childOfLabel(undefined)).toBe("Child");
  });
});

describe("newest first", () => {
  test("most recently added first, limited to the count", () => {
    const people = [
      person({ fullName: "Old", addedAt: "2026-10-01T00:00:00Z" }),
      person({ fullName: "Newest", addedAt: "2026-10-28T00:00:00Z" }),
      person({ fullName: "Middle", addedAt: "2026-10-15T00:00:00Z" }),
    ];
    expect(newestFirst(people, 2).map((p) => p.fullName)).toEqual(["Newest", "Middle"]);
  });
});

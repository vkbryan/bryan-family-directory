import { describe, expect, test } from "vitest";
import { isMicrosoftEmail, maskEmail } from "../../src/lib/email-providers";

describe("spotting Hotmail and Outlook addresses", () => {
  test("recognizes Microsoft's free email addresses", () => {
    for (const email of ["a@hotmail.com", "A@Outlook.com", "a@live.com", "a@msn.com", "a@hotmail.co.uk", " a@live.ca "]) {
      expect(isMicrosoftEmail(email)).toBe(true);
    }
  });

  test("leaves other addresses alone", () => {
    for (const email of ["a@gmail.com", "a@icloud.com", "a@myhotmail.com", "a@mail.outlook-fans.com","a@deliver.com", "not an email"]) {
      expect(isMicrosoftEmail(email)).toBe(false);
    }
  });
});

describe("masking an email address", () => {
  test("keeps the first two letters and the domain", () => {
    expect(maskEmail("vivian@example.com")).toBe("vi•••@example.com");
    expect(maskEmail("a@example.com")).toBe("a•••@example.com");
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

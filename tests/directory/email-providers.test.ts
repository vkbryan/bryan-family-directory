import { describe, expect, test } from "vitest";
import { isMicrosoftEmail } from "../../src/lib/email-providers";

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

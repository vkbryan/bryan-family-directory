"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { MONTHS } from "@/lib/directory-logic";
import { Avatar } from "@/components/avatar";
import { Button, Notice, TextField } from "@/components/ui";
import { SaveRow, SectionCard, SelectField, VisibilityChoice, type SaveState } from "@/components/form-bits";
import {
  addInterest,
  removeInterest,
  removePhoto,
  saveBasics,
  saveBirthday,
  saveContact,
  saveLocation,
  savePhotoVisibility,
  uploadPhoto,
} from "./actions";

export type EditableProfile = {
  id: string;
  isChild: boolean;
  fullName: string;
  aka: string | null;
  branchId: string | null;
  city: string | null;
  state: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  contactEmail: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  photoUrl: string | null;
  hasPhoto: boolean;
  visibility: Record<"location" | "photo" | "birthday" | "birthYear" | "email" | "phone" | "social", "members" | "private">;
  interests: { id: string; name: string }[];
};

type Visibility = "members" | "private";

const firstName = (p: EditableProfile) => p.aka || p.fullName.split(" ")[0];

// --- Photo ----------------------------------------------------------------------

/** Shrinks a photo to at most 1024px on the device before uploading, so it's quick even on a phone. */
async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("resize failed"))), "image/jpeg", 0.85),
  );
}

export function PhotoSection({ profile }: { profile: EditableProfile }) {
  const [state, upload, uploading] = useActionState<SaveState, FormData>(uploadPhoto.bind(null, profile.id), {});
  const [visState, saveVis, savingVis] = useActionState<SaveState, FormData>(savePhotoVisibility.bind(null, profile.id), {});
  const [localError, setLocalError] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [, startUpload] = useTransition();

  async function onChoose(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    try {
      const resized = await resizeToJpeg(file);
      const data = new FormData();
      data.append("photo", new File([resized], "photo.jpg", { type: "image/jpeg" }));
      startUpload(() => upload(data));
    } catch {
      setLocalError("That photo couldn't be opened. Please choose a JPG or PNG photo.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <SectionCard title="Photo" description="A clear photo of a face helps relatives recognize each other.">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size="lg" />
        <div className="flex flex-col gap-3">
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-accent px-5 py-3 font-semibold text-accent-foreground hover:bg-accent-hover">
            {uploading ? "Uploading…" : profile.hasPhoto ? "Choose a new photo" : "Add a photo"}
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => onChoose(e.target.files?.[0])}
            />
          </label>
          {profile.hasPhoto && (
            <Button
              type="button"
              variant="secondary"
              disabled={removing}
              onClick={() => startRemoving(() => removePhoto(profile.id))}
            >
              {removing ? "Removing…" : "Remove photo"}
            </Button>
          )}
        </div>
      </div>
      {(localError || state.error) && <Notice tone="error">{localError ?? state.error}</Notice>}
      {!uploading && state.saved && <Notice tone="success">New photo saved ✓</Notice>}
      <form action={saveVis} className="flex flex-col gap-4">
        <VisibilityChoice name="photoVisibility" value={profile.visibility.photo} isChild={profile.isChild} />
        <SaveRow state={visState} pending={savingVis} />
      </form>
    </SectionCard>
  );
}

// --- Name and branch ----------------------------------------------------------------

export function BasicsSection({ profile, branches }: { profile: EditableProfile; branches: { id: string; name: string }[] }) {
  const [state, save, pending] = useActionState<SaveState, FormData>(saveBasics.bind(null, profile.id), {});
  return (
    <SectionCard title="Name and branch">
      <form action={save} className="flex flex-col gap-5">
        <TextField id="fullName" name="fullName" label="Full name" defaultValue={profile.fullName} required error={state.fieldErrors?.fullName} />
        <TextField id="aka" name="aka" label="Nickname (optional)" hint="What does the family call them?" defaultValue={profile.aka ?? ""} />
        <SelectField id="branch" name="branch" label="Family branch" defaultValue={profile.branchId ?? ""}>
          <option value="">Not sure</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <SaveRow state={state} pending={pending} />
      </form>
    </SectionCard>
  );
}

// --- Where they live -----------------------------------------------------------------

export function LocationSection({ profile }: { profile: EditableProfile }) {
  const [state, save, pending] = useActionState<SaveState, FormData>(saveLocation.bind(null, profile.id), {});
  return (
    <SectionCard title="Where you live" description="City and state help relatives find family nearby.">
      <form action={save} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="city" name="city" label="City" defaultValue={profile.city ?? ""} autoComplete="address-level2" />
          <TextField id="state" name="state" label="State" defaultValue={profile.state ?? ""} autoComplete="address-level1" />
        </div>
        <VisibilityChoice name="locationVisibility" value={profile.visibility.location} isChild={profile.isChild} />
        <SaveRow state={state} pending={pending} />
      </form>
    </SectionCard>
  );
}

// --- Birthday --------------------------------------------------------------------------

export function BirthdaySection({ profile }: { profile: EditableProfile }) {
  const [state, save, pending] = useActionState<SaveState, FormData>(saveBirthday.bind(null, profile.id), {});
  return (
    <SectionCard title="Birthday" description="Family members can see upcoming birthdays if you share yours.">
      <form action={save} className="flex flex-col gap-5">
        <input type="hidden" name="isChild" value={String(profile.isChild)} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SelectField id="month" name="month" label="Month" defaultValue={profile.birthMonth ?? ""}>
            <option value="">—</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </SelectField>
          <SelectField id="day" name="day" label="Day" defaultValue={profile.birthDay ?? ""}>
            <option value="">—</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </SelectField>
          <TextField
            id="year"
            name="year"
            label={profile.isChild ? "Year" : "Year (optional)"}
            inputMode="numeric"
            maxLength={4}
            defaultValue={profile.birthYear ?? ""}
            error={state.fieldErrors?.year}
          />
        </div>
        {state.fieldErrors?.birthday && <Notice tone="error">{state.fieldErrors.birthday}</Notice>}
        <VisibilityChoice
          name="birthdayVisibility"
          label="Who can see the month and day?"
          value={profile.visibility.birthday}
          isChild={profile.isChild}
        />
        {profile.isChild ? (
          <p className="text-muted">A child&apos;s birth year is always private.</p>
        ) : (
          <VisibilityChoice
            name="birthYearVisibility"
            label="Who can see the year?"
            value={profile.visibility.birthYear}
            isChild={false}
          />
        )}
        <SaveRow state={state} pending={pending} />
      </form>
    </SectionCard>
  );
}

// --- Interests --------------------------------------------------------------------------

export function InterestsSection({ profile, suggestions }: { profile: EditableProfile; suggestions: string[] }) {
  const [state, add, pending] = useActionState<SaveState, FormData>(addInterest.bind(null, profile.id), {});
  const [removing, startRemoving] = useTransition();
  return (
    <SectionCard title="Interests" description="Hobbies and interests help relatives find what they have in common.">
      {profile.interests.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {profile.interests.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={removing}
                onClick={() => startRemoving(() => removeInterest(profile.id, h.id))}
                aria-label={`Remove ${h.name}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-foreground hover:border-danger"
              >
                {h.name} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">None yet.</p>
      )}
      <form action={add} className="flex flex-col gap-3">
        <TextField
          id="interest"
          name="interest"
          label="Add an interest"
          list="interest-suggestions"
          autoComplete="off"
          error={state.fieldErrors?.interest}
        />
        <datalist id="interest-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <SaveRow state={state} pending={pending} label="Add" />
      </form>
    </SectionCard>
  );
}

// --- Contact -----------------------------------------------------------------------------

export function ContactSection({ profile }: { profile: EditableProfile }) {
  const [state, save, pending] = useActionState<SaveState, FormData>(saveContact.bind(null, profile.id), {});
  const v = profile.visibility;
  return (
    <SectionCard
      title="Contact details"
      description={`Only what you fill in is shown, and only to the people you choose. Leave anything blank.`}
    >
      <form action={save} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <TextField id="email" name="email" type="email" label="Email" defaultValue={profile.contactEmail ?? ""} autoComplete="email" error={state.fieldErrors?.email} />
          <VisibilityChoice name="emailVisibility" label="Who can see the email?" value={v.email} isChild={false} />
        </div>
        <div className="flex flex-col gap-4">
          <TextField id="phone" name="phone" type="tel" label="Phone" defaultValue={profile.phone ?? ""} autoComplete="tel" />
          <VisibilityChoice name="phoneVisibility" label="Who can see the phone number?" value={v.phone} isChild={false} />
        </div>
        <div className="flex flex-col gap-4">
          <TextField id="instagram" name="instagram" label="Instagram" hint="Your handle, like @name" defaultValue={profile.instagram ? `@${profile.instagram}` : ""} />
          <TextField id="linkedin" name="linkedin" label="LinkedIn" hint="The address of your LinkedIn profile" defaultValue={profile.linkedin ?? ""} />
          <TextField id="website" name="website" label="Website" defaultValue={profile.website ?? ""} />
          <VisibilityChoice name="socialVisibility" label="Who can see Instagram, LinkedIn and website?" value={v.social} isChild={false} />
        </div>
        <SaveRow state={state} pending={pending} />
      </form>
    </SectionCard>
  );
}

export function ChildContactNote({ profile }: { profile: EditableProfile }) {
  return (
    <SectionCard title="Contact details">
      <p>
        Children&apos;s profiles don&apos;t have contact details, to keep {firstName(profile)} safe. Relatives can reach
        their parents or guardians instead.
      </p>
    </SectionCard>
  );
}

export type { Visibility };

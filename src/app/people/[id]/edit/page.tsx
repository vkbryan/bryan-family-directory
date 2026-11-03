import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ageOn } from "@/lib/age";
import { getMyEventNews } from "@/lib/event-news";
import { EventNewsForm } from "@/components/event-news-form";
import { Loading } from "@/components/ui";
import { SectionCard } from "@/components/form-bits";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  BasicsSection,
  BirthdaySection,
  ChildContactNote,
  ContactSection,
  InterestsSection,
  LocationSection,
  PhotoSection,
  type EditableProfile,
} from "./sections";
import { GuardiansSection } from "./guardians-section";
import { ParentsSection } from "./parents-section";

export const metadata = { title: "Edit profile · Bryan Family Directory" };

export default function EditPage({ params }: PageProps<"/people/[id]/edit">) {
  return (
    <Suspense fallback={<Loading />}>
      <EditContent params={params} />
    </Suspense>
  );
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (viewer.state !== "member") redirect("/");

  const supabase = await createClient();
  // The full record is only readable by people who may edit it.
  const { data: p } = await supabase
    .from("profiles")
    .select(
      "id, account_id, profile_type, full_name, aka, city, state, birth_year, birth_month, birth_day, photo_path, contact_email, phone, instagram, linkedin, website, location_visibility, photo_visibility, birthday_visibility, birth_year_visibility, email_visibility, phone_visibility, social_visibility, archived_at, profile_branches(branch_id, is_primary), profile_hobbies(hobbies(id, name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p || p.archived_at) notFound();

  const isChild = p.profile_type === "child";
  const isMe = viewer.profile.id === p.id;

  const [{ data: branches }, { data: allHobbies }, photo, guardians, requests, members, parentLinks, adults, eventNews] = await Promise.all([
    supabase.from("family_branches").select("id, name").order("sort_order").order("name"),
    supabase.from("hobbies").select("name").order("name"),
    p.photo_path ? supabase.storage.from("profile-photos").createSignedUrl(p.photo_path, 3600) : null,
    isChild ? supabase.rpc("profile_guardians", { p_profile_id: p.id }) : null,
    isChild ? supabase.rpc("pending_co_guardian_requests", { p_profile_id: p.id }) : null,
    isChild && viewer.isAdmin
      ? supabase.from("profiles").select("account_id, full_name").not("account_id", "is", null).is("archived_at", null).order("full_name")
      : null,
    isChild && viewer.isAdmin
      ? supabase.from("family_relationships").select("id, person_a, detail").eq("relationship", "parent").eq("person_b", p.id)
      : null,
    isChild && viewer.isAdmin
      ? supabase.from("profiles").select("id, full_name").eq("profile_type", "adult").is("archived_at", null).order("full_name")
      : null,
    // Event news belongs to the person signed in, so only on their own profile.
    isMe ? getMyEventNews() : null,
  ]);

  const profile: EditableProfile = {
    id: p.id,
    isMe,
    isChild,
    fullName: p.full_name,
    aka: p.aka,
    branchId: p.profile_branches.find((b) => b.is_primary)?.branch_id ?? p.profile_branches[0]?.branch_id ?? null,
    city: p.city,
    state: p.state,
    birthMonth: p.birth_month,
    birthDay: p.birth_day,
    birthYear: p.birth_year,
    contactEmail: p.contact_email,
    phone: p.phone,
    instagram: p.instagram,
    linkedin: p.linkedin,
    website: p.website,
    photoUrl: photo?.data?.signedUrl ?? null,
    hasPhoto: Boolean(p.photo_path),
    visibility: {
      location: p.location_visibility,
      photo: p.photo_visibility,
      birthday: p.birthday_visibility,
      birthYear: p.birth_year_visibility,
      email: p.email_visibility,
      phone: p.phone_visibility,
      social: p.social_visibility,
    },
    interests: p.profile_hobbies
      .map((ph) => ph.hobbies)
      .filter((h): h is { id: string; name: string } => Boolean(h))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };

  const iAmGuardian = (guardians?.data ?? []).some((g) => g.is_me);
  const age = p.birth_year ? ageOn(new Date(), p.birth_year, p.birth_month, p.birth_day) : null;
  // Offered from age 13. Admins may also hand over a child whose birth year is unknown.
  const oldEnough = age === null ? viewer.isAdmin : age >= 13;
  const canHandOver = isChild && !p.account_id && oldEnough && (viewer.isAdmin || iAmGuardian);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: isMe ? "My profile" : p.full_name, href: `/people/${p.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{isMe ? "Edit your profile" : `Edit ${p.full_name}'s profile`}</h1>
        <p className="text-muted">Every part is optional except a name. Save each section when you&apos;re done with it.</p>
      </div>
      <PhotoSection profile={profile} />
      <BasicsSection profile={profile} branches={branches ?? []} />
      <LocationSection profile={profile} />
      <BirthdaySection profile={profile} />
      <InterestsSection profile={profile} suggestions={(allHobbies ?? []).map((h) => h.name)} />
      {isChild ? <ChildContactNote profile={profile} /> : <ContactSection profile={profile} />}
      {eventNews && (
        <SectionCard title="Family events" description="Get news about reunions and other family events by email.">
          <EventNewsForm news={eventNews} />
        </SectionCard>
      )}
      {isChild && (
        <GuardiansSection
          profileId={p.id}
          childName={p.aka || p.full_name}
          guardians={(guardians?.data ?? []).map((g) => ({ accountId: g.account_id, fullName: g.full_name, isMe: g.is_me }))}
          requests={(requests?.data ?? []).map((r) => ({ id: r.id, requesterName: r.requester_name, message: r.message }))}
          canHandOver={canHandOver}
          isAdmin={viewer.isAdmin}
          members={(members?.data ?? []).map((m) => ({ accountId: m.account_id!, fullName: m.full_name }))}
        />
      )}
      {isChild && viewer.isAdmin && (
        <ParentsSection
          childId={p.id}
          childName={p.aka || p.full_name}
          parents={(parentLinks?.data ?? []).map((l) => ({
            id: l.id,
            name: adults?.data?.find((a) => a.id === l.person_a)?.full_name ?? "A family member",
            detail: l.detail,
          }))}
          adults={(adults?.data ?? []).map((a) => ({ id: a.id, name: a.full_name }))}
        />
      )}
    </div>
  );
}

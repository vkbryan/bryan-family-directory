// Plain-language messages for the short error codes the database raises.

const messages: Record<string, string> = {
  not_signed_in: "Please sign in again.",
  not_allowed: "You don't have permission to do that.",
  invitation_invalid: "This invitation link isn't valid. Ask the relative who invited you for a new one.",
  invitation_revoked: "This invitation was cancelled. Ask the relative who invited you for a new one.",
  invitation_already_used: "This invitation has already been used. Ask the relative who invited you for a new one.",
  invitation_expired: "This invitation has expired. Ask the relative who invited you for a new one.",
  already_has_profile: "You already have a profile in the directory.",
  profile_already_claimed: "Someone has already claimed this profile. Contact a family admin if that's a mistake.",
  memorial_profiles_cannot_be_claimed: "This is a memorial profile and can't be claimed.",
  already_guardian: "You already help manage this profile.",
  too_many_guardians: "This profile already has the most guardians allowed.",
};

export function friendlyError(error: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  if (!error?.message) return fallback;
  return messages[error.message] ?? fallback;
}

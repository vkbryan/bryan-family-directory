-- =============================================================================
-- Restore the sign-in service's access to the sign-up gate.
--
-- Deleting the mistaken "Send Email" hook in the Supabase dashboard also
-- revoked supabase_auth_admin's USAGE on the private schema, which the
-- remaining "Before User Created" hook needs. Every new sign-up then failed
-- with "Error running hook". Safe to re-run: grants are idempotent.
-- =============================================================================

grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;

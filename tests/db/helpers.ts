// Test harness: a real Postgres database (PGlite) running in memory, with our
// migrations applied. Each test gets its own copy, so tests never affect each other.
// All people here are made up. Never use real family data in tests.

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");

let template: Promise<PGlite> | undefined;

async function buildTemplate(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

export async function freshDb(): Promise<TestDb> {
  template ??= buildTemplate();
  return new TestDb((await (await template).clone()) as PGlite);
}

type Row = Record<string, unknown>;

export class TestDb {
  constructor(private readonly db: PGlite) {}

  // --- who is acting -------------------------------------------------------

  /** Act as the database owner (like a migration or the import script). */
  async asSystem() {
    await this.db.exec("reset role");
    await this.db.query("select set_config('request.jwt.claim.sub', '', false)");
    return this;
  }

  /** Act as a signed-in user, exactly as Supabase does for app requests. */
  async as(accountId: string) {
    await this.db.exec("reset role");
    await this.db.query("select set_config('request.jwt.claim.sub', $1, false)", [accountId]);
    await this.db.exec("set role authenticated");
    return this;
  }

  /** Act as a signed-out visitor. */
  async asAnon() {
    await this.db.exec("reset role");
    await this.db.query("select set_config('request.jwt.claim.sub', '', false)");
    await this.db.exec("set role anon");
    return this;
  }

  // --- queries ----------------------------------------------------------------

  async rows<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, params)).rows;
  }

  async one<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
    const rows = await this.rows<T>(sql, params);
    if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}`);
    return rows[0];
  }

  async value<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
    const row = await this.one<Row>(sql, params);
    return Object.values(row)[0] as T;
  }

  /** Runs a statement and returns how many rows it changed. */
  async run(sql: string, params: unknown[] = []): Promise<number> {
    return (await this.db.query(sql, params)).affectedRows ?? 0;
  }

  // --- made-up people ---------------------------------------------------------

  /** Creates a sign-in account. Runs as system. */
  async account(opts: { admin?: boolean; deactivated?: boolean } = {}): Promise<string> {
    await this.asSystem();
    const id = await this.value<string>("insert into auth.users default values returning id");
    await this.run("update public.accounts set role = $2, status = $3 where id = $1", [
      id,
      opts.admin ? "admin" : "member",
      opts.deactivated ? "deactivated" : "active",
    ]);
    return id;
  }

  /**
   * What Supabase does when someone new requests a sign-in code: creates the
   * sign-in user (with whatever invitation they carried), which starts as a
   * pending account. Runs as system.
   */
  async signUp(opts: { invitation?: string; confirmed?: boolean } = {}): Promise<string> {
    await this.asSystem();
    return this.value<string>(
      "insert into auth.users (raw_user_meta_data, email_confirmed_at) values ($1, $2) returning id",
      [opts.invitation ? { invitation: opts.invitation } : {}, opts.confirmed === false ? null : new Date()],
    );
  }

  /** Calls the sign-up gate the way Supabase's sign-in service does. */
  async signUpGate(invitation?: string, hookName = "before-user-created"): Promise<{ error?: { message: string } }> {
    await this.db.exec("reset role");
    await this.db.exec("set role supabase_auth_admin");
    const event = {
      metadata: { name: hookName },
      user: { email: "new@example.test", user_metadata: invitation ? { invitation } : {} },
    };
    const result = await this.value<{ error?: { message: string } }>("select private.before_user_created($1)", [event]);
    await this.db.exec("reset role");
    return result;
  }

  /** Creates a profile directly. Runs as system. */
  async profile(fields: Row = {}): Promise<string> {
    await this.asSystem();
    const data: Row = { full_name: "Test Person", ...fields };
    const cols = Object.keys(data);
    const params = cols.map((_, i) => `$${i + 1}`);
    return this.value<string>(
      `insert into public.profiles (${cols.join(", ")}) values (${params.join(", ")}) returning id`,
      Object.values(data),
    );
  }

  /** An account with its own adult profile. */
  async member(name: string, opts: { admin?: boolean; deactivated?: boolean } = {}) {
    const accountId = await this.account(opts);
    const profileId = await this.profile({ full_name: name, account_id: accountId, source: "self" });
    return { accountId, profileId };
  }

  async branch(name: string): Promise<string> {
    await this.asSystem();
    return this.value<string>("insert into public.family_branches (name) values ($1) returning id", [name]);
  }
}

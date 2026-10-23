import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Shared building blocks. Touch targets are at least 48px tall, and every
// field has a visible label, for comfortable use by relatives of all ages.

const buttonBase =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg px-5 py-3 text-base font-semibold transition-colors disabled:opacity-60 sm:w-auto";

const buttonStyles = {
  primary: `${buttonBase} bg-accent text-accent-foreground hover:bg-accent-hover`,
  secondary: `${buttonBase} border border-border bg-surface text-foreground hover:bg-background`,
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return <button className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={`${buttonStyles[variant]} no-underline ${className}`} {...props} />;
}

export function TextField({
  label,
  hint,
  error,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string; id: string }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-12 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-surface p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const color = { info: "text-foreground", error: "text-danger", success: "text-success" }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border border-border bg-background p-4 ${color}`}>
      {children}
    </p>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="text-muted">
      {label}
    </p>
  );
}

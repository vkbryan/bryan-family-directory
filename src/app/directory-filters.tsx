"use client";

import Form from "next/form";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MONTHS, type Filters } from "@/lib/directory-logic";
import { Button } from "@/components/ui";

type Option = { value: string; label: string };

/**
 * Search box plus filters. Choices go into the page address (?branch=…),
 * so the back button works and filtered views can be shared. Changing a
 * filter shows results right away; the button is there for keyboards and
 * for when scripts are off.
 */
export function DirectoryFilters({
  filters,
  branches,
  states,
  cities,
  hobbies,
}: {
  filters: Filters;
  branches: Option[];
  states: Option[];
  cities: Option[];
  hobbies: Option[];
}) {
  const activeCount = [filters.branch, filters.state, filters.city, filters.hobby, filters.month].filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <Form action="/" className="flex flex-col gap-4" role="search">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="q" className="font-medium">
          Search by name or nickname
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            autoComplete="off"
            className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
          />
          <Button type="submit" className="!w-auto">
            Search
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="more-filters"
        className="self-start py-2 font-medium text-accent underline underline-offset-4"
      >
        {open ? "Hide advanced search" : `Advanced search${activeCount ? ` (${activeCount} on)` : ""}`}
      </button>

      <div id="more-filters" hidden={!open} className="grid gap-4 sm:grid-cols-2">
        <Select name="branch" label="Family branch" value={filters.branch} options={branches} />
        <Select name="hobby" label="Interest" value={filters.hobby} options={hobbies} />
        <Select name="state" label="State" value={filters.state} options={states} />
        <Select name="city" label="City" value={filters.city} options={cities} />
        <Select
          name="month"
          label="Birthday month"
          value={filters.month}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
      </div>

      {(activeCount > 0 || filters.q) && (
        <p>
          <Link href="/">Clear search and filters</Link>
        </p>
      )}
    </Form>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Option[] }) {
  return (
    <Field label={label} id={`filter-${name}`}>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-12 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

import { isKnownPlace, OUTSIDE_US, US_STATES } from "@/lib/places";
import { SelectField } from "./form-bits";

/** State dropdown: US states first, then places outside the US. */
export function StateSelect({ label = "State", defaultValue }: { label?: string; defaultValue?: string | null }) {
  const current = defaultValue ?? "";
  return (
    <SelectField id="state" name="state" label={label} defaultValue={current} autoComplete="address-level1">
      <option value="">Choose…</option>
      {/* Keep an old hand-typed value selectable until it's changed. */}
      {current && !isKnownPlace(current) && <option value={current}>{current}</option>}
      <optgroup label="United States">
        {US_STATES.map(([code, name]) => (
          <option key={code} value={name}>
            {name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Outside the US">
        {OUTSIDE_US.map((place) => (
          <option key={place} value={place}>
            {place}
          </option>
        ))}
      </optgroup>
    </SelectField>
  );
}

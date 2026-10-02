"use client";

/**
 * Form controls, borderless.
 *
 * A text input with no box is the hardest thing in this system to get
 * right — strip the border and people stop seeing a field at all. Three
 * things put it back without drawing one:
 *
 *   - a **baseline rule** under the text, which is the oldest form
 *     affordance there is and reads as "write here" at a glance;
 *   - that rule **lights up on focus** and the label goes cyan, so the
 *     active field is the brightest thing on the screen;
 *   - the value is set in the **pixel face**, which makes typed text look
 *     like input rather than copy.
 *
 * Every field is labelled. A placeholder is not a label: it disappears the
 * moment someone types, and on a form asking for a date of birth that is
 * the difference between a filled field and a rejected one.
 */

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./ui";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function Field({ label, hint, error, className, id, ...props }: FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="group flex flex-col gap-2">
      <label htmlFor={fieldId} className="cursor-pointer">
        <Label
          tone={error ? "heart" : "faint"}
          className="transition-colors group-focus-within:text-cyan"
        >
          {label}
        </Label>
      </label>

      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "w-full bg-transparent pb-2.5 outline-none",
          "font-pixel text-[13px] uppercase tracking-[0.08em] text-ink",
          "placeholder:text-ink-faint/50 placeholder:tracking-[0.1em]",
          // The rule *is* the field. Focus brightens and thickens it.
          "border-b transition-all duration-200",
          error
            ? "border-danger [box-shadow:0_1px_0_0_rgb(255_59_48/0.5)]"
            : "border-blue-dim focus:border-cyan focus:[box-shadow:0_1px_0_0_rgb(1_231_255/0.6),0_2px_12px_-2px_rgb(1_231_255/0.5)]",
          // Browsers draw their own focus ring; ours is the rule.
          "focus-visible:outline-none focus-visible:shadow-none",
          className,
        )}
        {...props}
      />

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="font-body text-[11px] uppercase tracking-[0.1em] text-danger"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="font-body text-[11px] leading-4 text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A choice between two or three things, as big tappable text.
 *
 * Used for the side-picker and anywhere a radio group would otherwise
 * appear. Rendered as real radios under the hood so arrow keys, labels and
 * form submission all behave — the visual is a `peer-checked` restyle, not
 * a div pretending.
 */
export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string; description?: string; icon?: ReactNode }[];
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-3">
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className="group relative cursor-pointer select-none py-5"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />

            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className={cn(
                  "mt-1 w-4 shrink-0 font-pixel text-[14px] transition-all duration-200",
                  checked
                    ? "translate-x-0 text-cyan opacity-100 [text-shadow:var(--glow-cyan)]"
                    : "-translate-x-1 text-cyan opacity-0 group-hover:translate-x-0 group-hover:opacity-50",
                )}
              >
                ▶
              </span>

              {option.icon ? (
                <span
                  className={cn(
                    "shrink-0 transition-opacity duration-200",
                    checked ? "opacity-100" : "opacity-35 group-hover:opacity-70",
                  )}
                >
                  {option.icon}
                </span>
              ) : null}

              <span className="flex min-w-0 flex-col gap-1.5">
                <span
                  className={cn(
                    "font-pixel text-[16px] uppercase tracking-[0.12em] transition-all duration-200",
                    checked
                      ? "text-ink [text-shadow:var(--glow-cyan)]"
                      : "text-ink-faint group-hover:text-ink-muted",
                  )}
                >
                  {option.label}
                </span>
                {option.description ? (
                  <span
                    className={cn(
                      "font-body text-body-sm leading-[18px] transition-colors duration-200",
                      checked ? "text-ink-muted" : "text-ink-faint",
                    )}
                  >
                    {option.description}
                  </span>
                ) : null}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

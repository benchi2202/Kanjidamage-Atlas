import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Section({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"control-section " + className}>
      <div className="control-heading">
        <h3>{title}</h3>
        {hint ? <span>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={option.value === value ? "active" : ""}
          onClick={() => onChange(option.value)}
          title={option.title}
          aria-pressed={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button type="button" className="toggle-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className={"toggle " + (checked ? "on" : "")} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

export function Stars({ value, size = 11 }: { value: number | null | undefined; size?: number }) {
  const count = Math.max(0, Math.min(5, value ?? 0));
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={count + " out of 5 usefulness"}>
      {"★".repeat(count)}
      <span className="stars-empty">{"★".repeat(5 - count)}</span>
    </span>
  );
}

export function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" }) {
  return <p className={"note-box " + tone}>{children}</p>;
}

export function LinkButton({
  href,
  children,
  icon = "external",
}: {
  href: string;
  children: ReactNode;
  icon?: "external" | "arrow-right";
}) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <Icon name={icon} size={13} />
    </a>
  );
}

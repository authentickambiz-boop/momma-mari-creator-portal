type IconProps = { className?: string };

const BLACK = "#1C1A1F";
const ORANGE = "#E8873A";
const PURPLE = "#6B46A3";
const PURPLE_SOFT = "#E6D8F6";

export function GhostIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 72" aria-hidden="true">
      <path
        fill="#FFF8F1"
        stroke={BLACK}
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M14 34c0-12 8-22 18-22s18 10 18 22v26l-6-6-6 6-6-6-6 6-6-6-6 6V34z"
      />
      <circle cx="26" cy="34" r="2.6" fill={BLACK} />
      <circle cx="40" cy="34" r="2.6" fill={BLACK} />
      <path d="M28 44c2.2 2.6 5.8 2.6 8 0" fill="none" stroke={BLACK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="40" r="3.2" fill={ORANGE} />
      <circle cx="44" cy="40" r="3.2" fill={PURPLE_SOFT} />
    </svg>
  );
}

export function BatIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 72 40" aria-hidden="true">
      <path
        fill={PURPLE}
        stroke={BLACK}
        strokeWidth="2"
        strokeLinejoin="round"
        d="M36 20c-4-8-12-8-20-3 4 2 6 7 4 11 6-4 11-4 16-2 5-2 10-2 16 2-2-4 0-9 4-11-8-5-16-5-20 3z"
      />
      <ellipse cx="36" cy="22" rx="8" ry="7" fill="#F6F0FC" stroke={BLACK} strokeWidth="2" />
      <circle cx="33" cy="21" r="1.3" fill={BLACK} />
      <circle cx="39" cy="21" r="1.3" fill={BLACK} />
      <path d="M33 25c1.6 1.6 4.4 1.6 6 0" fill="none" stroke={BLACK} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="30" cy="24" r="1.6" fill={ORANGE} />
      <circle cx="42" cy="24" r="1.6" fill={ORANGE} />
    </svg>
  );
}

export function PumpkinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 12c1.5-5 7-6 9-4" fill="none" stroke={PURPLE} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="24" cy="28" rx="14" ry="13" fill={ORANGE} stroke={BLACK} strokeWidth="2" />
      <path d="M24 16c-1 6-1 16 0 23M17 18c-3 4-4 12-2 18M31 18c3 4 4 12 2 18" fill="none" stroke="#C86A22" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="19" cy="27" r="1.6" fill={BLACK} />
      <circle cx="29" cy="27" r="1.6" fill={BLACK} />
      <path d="M21 32c1.6 1.8 4.4 1.8 6 0" fill="none" stroke={BLACK} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

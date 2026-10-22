/**
 * The flight's balloon, drawn once and reused by the sky panel and the nav
 * pill. `inflation` (0-1) shrinks the envelope while grounded, so a balloon
 * filling toward liftoff visibly grows.
 */
export function Balloon({ size, inflation = 1 }: { size: number; inflation?: number }) {
  const rx = 9 + 11 * inflation;
  const ry = 9 + 13 * inflation;
  const cy = 44 - ry;

  return (
    <svg width={size} height={(size * 66) / 48} viewBox="0 0 48 66" aria-hidden="true">
      <ellipse cx="24" cy={cy} rx={rx} ry={ry} fill="var(--color-balloon)" />
      <ellipse
        cx={24 - rx * 0.35}
        cy={cy - ry * 0.3}
        rx={rx * 0.22}
        ry={ry * 0.4}
        fill="var(--color-balloon-light)"
        opacity="0.55"
      />
      <line
        x1={24 - rx * 0.5}
        y1={cy + ry * 0.85}
        x2="19"
        y2="54"
        stroke="var(--color-balloon-light)"
        strokeWidth="1"
      />
      <line
        x1={24 + rx * 0.5}
        y1={cy + ry * 0.85}
        x2="29"
        y2="54"
        stroke="var(--color-balloon-light)"
        strokeWidth="1"
      />
      <rect x="17" y="54" width="14" height="10" rx="2" fill="var(--color-basket)" />
    </svg>
  );
}

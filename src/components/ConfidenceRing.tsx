import { Check } from "lucide-react";

type Props = {
  confidence: number | null;
  verified: boolean;
  size?: number;
};

function bandColor(verified: boolean, confidence: number | null): string {
  if (verified) return "oklch(0.62 0.17 148)"; // solid green
  const c = confidence ?? 0;
  if (c >= 0.65) return "oklch(0.68 0.15 148)"; // green-leaning
  if (c >= 0.5) return "oklch(0.75 0.15 75)"; // amber
  return "oklch(0.85 0.09 85)"; // light amber (floor)
}

function bandLabel(verified: boolean, confidence: number | null): string {
  if (verified) return "Verified";
  const c = confidence ?? 0;
  if (c >= 0.65) return "Good estimate";
  if (c >= 0.5) return "Fair estimate";
  return "Rough estimate";
}

export function ConfidenceRing({ confidence, verified, size = 20 }: Props) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = verified ? 1 : Math.max(0, Math.min(1, confidence ?? 0));
  const color = bandColor(verified, confidence);
  const label = bandLabel(verified, confidence);
  const tooltip = verified
    ? "Confirmed by the restaurant."
    : "AI estimate from the menu description. The calorie and macro range shows the likely spread — it gets tighter once the restaurant verifies.";

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={tooltip}
      aria-label={tooltip}
    >
      <span
        className="inline-flex items-center justify-center relative"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="block -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="oklch(0.92 0.008 90)"
            strokeWidth={stroke}
          />
          {!verified && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={`${circ * pct} ${circ}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        {verified && (
          <Check
            className="absolute"
            style={{ width: size * 0.6, height: size * 0.6, color }}
            strokeWidth={3}
          />
        )}
      </span>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </span>
  );
}

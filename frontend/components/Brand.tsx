import Image from "next/image";

/** The VedaAI mark, exported from the design. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/vedaai-logo.png"
      alt=""
      width={165}
      height={165}
      priority
      style={{ width: size, height: size }}
      className="shrink-0 select-none"
    />
  );
}

/**
 * A four-point sparkle centred on (cx, cy). The Bézier control points sit close
 * to the centre, which is what pinches the waist and gives the arms their long
 * concave taper — the shape the design uses throughout.
 */
function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.32;
  return [
    `M${cx},${cy - r}`,
    `C${cx},${cy - k} ${cx + k},${cy} ${cx + r},${cy}`,
    `C${cx + k},${cy} ${cx},${cy + k} ${cx},${cy + r}`,
    `C${cx},${cy + k} ${cx - k},${cy} ${cx - r},${cy}`,
    `C${cx - k},${cy} ${cx},${cy - k} ${cx},${cy - r}`,
    "Z"
  ].join(" ");
}

/** The AI sparkle, used in the toolkit pill and the top bar. */
export function Sparkle({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
      <path d={sparklePath(12, 12, 11)} />
    </svg>
  );
}

/**
 * The loading-screen cluster: a large star with a smaller one overlapping its
 * lower-left arm, plus a faint star and dot. Drawn as one SVG so the overlap
 * stays exact at any size.
 */
export function SparkleCluster() {
  return (
    // Centres and radii traced from the design, so the big star's lower arm and
    // the medium star's right arm meet the way they do there.
    <svg
      viewBox="0 0 140 120"
      className="h-[155px] w-[181px] text-brand"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={sparklePath(78, 48, 32)} />
      <path d={sparklePath(54, 87, 24)} />
      <path
        d={sparklePath(96, 87, 8)}
        fillOpacity="0.55"
        className="animate-pulse [animation-duration:2.6s]"
      />
      <circle
        cx="34"
        cy="53"
        r="4.6"
        fillOpacity="0.6"
        className="animate-pulse [animation-duration:2.6s] [animation-delay:.8s]"
      />
    </svg>
  );
}

/**
 * The teacher illustration on the upload screen — the artwork from the design,
 * exported with a transparent background so it sits on the panel gradient.
 * Purely decorative, so the alt text is intentionally empty.
 */
export function TeacherBadge() {
  return (
    <Image
      src="/teacher.png"
      alt=""
      width={273}
      height={273}
      priority
      className="h-[144px] w-[144px] select-none"
    />
  );
}

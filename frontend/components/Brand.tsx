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
 * concave taper - the shape the design uses throughout.
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
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={sparklePath(12, 12, 11)} />
    </svg>
  );
}

/**
 * The toolkit button uses a pair - a large sparkle with a small one tucked
 * against its upper right, which is how the design draws it.
 */
export function SparkleDuo({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={sparklePath(16, 25, 15)} />
      <path d={sparklePath(31, 11, 8)} />
    </svg>
  );
}

/**
 * The loading-screen cluster, inlined from the design's `sparkle-loader`
 * export rather than linked as a file: the four stars twinkle on a stagger,
 * which needs each path addressable. Their inner white glows are the export's
 * own filters, so the gloss survives the move.
 */
export function SparkleCluster() {
  return (
    <svg
      viewBox="0 0 129 135"
      // The stagger rides on inline styles: the shared `animate-*` shorthand is
      // set through a `> g` selector, which outranks any delay class on the
      // child and would reset every star back to the same beat.
      className="h-[135px] w-[129px] [&>g]:origin-center [&>g]:animate-twinkle [&>g]:[transform-box:fill-box]"
      fill="#FF5623"
      aria-hidden="true"
    >
      <g filter="url(#sparkle-glow-lg)">
        <path d="M32.6207 48.0082C70.2099 47.7358 80.2882 15.8892 80.6287 0C80.6287 37.8617 112.634 47.7812 128.637 48.0082C90.5028 47.4634 80.7423 80.0137 80.6287 96.3569C80.6287 57.4055 48.6234 47.8948 32.6207 48.0082Z" />
      </g>
      <g filter="url(#sparkle-glow-md)" style={{ animationDelay: "-1.8s" }}>
        <path d="M12.5467 98.7385C40.7386 98.5342 48.2974 74.6492 48.5527 62.7324C48.5527 91.1286 72.5568 98.5682 84.5588 98.7385C55.9582 98.3299 48.6379 122.743 48.5527 135C48.5527 105.787 24.5487 98.6534 12.5467 98.7385Z" />
      </g>
      <g filter="url(#sparkle-glow-sm)" opacity="0.52" style={{ animationDelay: "-1.2s" }}>
        <path d="M90.3345 98.4638C101.611 98.3822 104.635 88.8282 104.737 84.0614C104.737 95.4199 114.339 98.3957 119.139 98.4638C107.699 98.3004 104.771 108.066 104.737 112.968C104.737 101.283 95.1352 98.4298 90.3345 98.4638Z" />
      </g>
      <g filter="url(#sparkle-glow-dot)" opacity="0.83" style={{ animationDelay: "-0.6s" }}>
        <circle cx="23.8386" cy="53.9502" r="6.2736" />
      </g>

      {/* Inner white glow: blur the alpha, punch out the shape, tint white. */}
      <defs>
        {[
          ["sparkle-glow-lg", 3.74979, 1],
          ["sparkle-glow-md", 3.74979, 1],
          ["sparkle-glow-sm", 2.49986, 1],
          ["sparkle-glow-dot", 4.99971, 0.5]
        ].map(([id, blur, alpha]) => (
          <filter key={id} id={id as string}>
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feGaussianBlur stdDeviation={blur} />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values={`0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${alpha} 0`} />
            <feBlend mode="normal" in2="SourceGraphic" />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

/**
 * The teacher illustration on the upload screen - the artwork from the design,
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
      className="h-[clamp(80px,16vh,144px)] w-[clamp(80px,16vh,144px)] select-none"
    />
  );
}

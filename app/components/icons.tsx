/**
 * Hand-drawn SVG icons for the courtroom. Pure graphics only:
 * no letters, words, or emoji inside any glyph.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function GavelIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* head */}
      <path d="M13.6 3.2 20.8 10.4" strokeWidth={4.4} />
      {/* handle */}
      <path d="M12.2 11.4 4.4 19.2" strokeWidth={2.4} />
      {/* sound block */}
      <path d="M2.5 21.8h7" strokeWidth={2.2} />
    </Base>
  );
}

export function UtensilsIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* fork */}
      <path d="M5.5 2.5v5.6a2.5 2.5 0 0 0 5 0V2.5" />
      <path d="M8 2.5V6" />
      <path d="M8 10.6v10.9" />
      {/* knife */}
      <path d="M16.5 2.5v9.2" />
      <path d="M16.5 2.5c2.2 2.4 2.6 6.2 0 9.2" />
      <path d="M16.5 11.7v9.8" />
    </Base>
  );
}

export function SushiIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* maki roll */}
      <ellipse cx="12" cy="13.5" rx="8" ry="5.8" />
      {/* rice edge */}
      <ellipse cx="12" cy="13.5" rx="5" ry="3.4" />
      {/* filling */}
      <circle cx="12" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
      {/* chopsticks */}
      <path d="M3 4.5 13 9.5" />
      <path d="M5.5 2.8 15.5 7.8" />
    </Base>
  );
}

/** Tag-shaped evidence chip glyph. */
export function EvidenceIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 11.5v-7a1 1 0 0 1 1-1h7l9 9-8.5 8.5-8.5-9.5Z" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6Z" />
    </svg>
  );
}

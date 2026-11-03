import type { SVGProps } from "react";

/** Line icons, 24×24, stroke 1.8 (docs/DESIGN.md). Decorative by default. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6z" />
    <path d="M9 12l2 2l4-4" />
  </Svg>
);
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
    <circle cx="12" cy="10" r="2.2" />
  </Svg>
);
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h16" />
    <path d="M4 16h16" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6l-6 6" />
  </Svg>
);
export const IconCamera = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12l4 4l10-10" />
  </Svg>
);
export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6l9-6" />
  </Svg>
);
export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c-4-3-8-6-8-11a5 5 0 0 1 8-3a5 5 0 0 1 8 3c0 5-4 8-8 11z" />
  </Svg>
);
export const IconNoDiet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z" />
  </Svg>
);
export const IconBed = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18h18" />
    <path d="M5 18v-5h14v5" />
    <path d="M7 13V9a2 2 0 0 1 2-2h2" />
  </Svg>
);
export const IconGauge = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </Svg>
);
export const IconPulse = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 15l3-6l3 4l3-7l3 9" />
  </Svg>
);
export const IconDrop = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" />
  </Svg>
);
export const IconMonitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11l8-6l8 6v9H4z" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);
export const IconBriefcase = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="7" width="16" height="13" rx="2" />
    <path d="M9 7V5h6v2" />
  </Svg>
);
export const IconInstagram = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="5" />
    <circle cx="12" cy="12" r="3.5" />
  </Svg>
);
export const IconFacebook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />
  </Svg>
);
export const IconTikTok = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4v10a4 4 0 1 1-4-4" />
    <path d="M14 4c1 3 3 4 5 4" />
  </Svg>
);
export const IconStar = ({ size = 18, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M12 3l2.6 5.6l6 .7l-4.5 4.1l1.2 6L12 16.4L6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
  </svg>
);
export const IconQuote = (p: SVGProps<SVGSVGElement>) => (
  <svg width="28" height="20" viewBox="0 0 28 20" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <path d="M0 20V12C0 5 4 1 11 0l1 3C8 4 6 7 6 10h5v10zM16 20V12c0-7 4-11 11-12l1 3c-4 1-6 4-6 7h5v10z" />
  </svg>
);

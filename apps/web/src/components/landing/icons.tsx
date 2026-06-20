import type { SVGProps } from "react";

/* A small, consistent line-icon set drawn at 24×24 on a 1.7 stroke. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function LogoMark({ size = 28, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      {...props}
    >
      <circle cx="16" cy="16" r="14" fill="var(--accent)" opacity="0.12" />
      <path
        d="M9 19.5 13.5 9l3 7 2-3.5L23 19.5"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="2.4" fill="var(--accent)" />
    </svg>
  );
}

export function Sparkle(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" />
    </svg>
  );
}

export function FileText(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function Kanban(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </svg>
  );
}

export function GitBranch(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M6 8.5v7M18 10.5c0 4-4 3.5-12 5.5" />
    </svg>
  );
}

export function ShieldCheck(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CheckCircle(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function MessageSearch(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-9 8.3L3 21l1.2-4.5A8.5 8.5 0 1 1 21 11.5Z" />
      <circle cx="11" cy="11" r="2.5" />
      <path d="m14 14 2 2" />
    </svg>
  );
}

export function Rocket(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="M5 15c-1 2-1 5-1 5s3 0 5-1m-4-4 2 2m-2-2c1-6 5-10 11-11 .5 4-1 9-6 11-2 .8-4 .8-5 0Z" />
      <circle cx="14.5" cy="9.5" r="1.5" />
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function GitHub(props: IconProps) {
  return (
    <svg {...base({ ...props, strokeWidth: 0 })} fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.9c-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

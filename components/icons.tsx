// Small line icons, drawn here so the dashboard needs no icon dependency.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Icon>
);

export const BellIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 10a6 6 0 0 1 12 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5Z" />
    <path d="M10 20a2.2 2.2 0 0 0 4 0" />
  </Icon>
);

export const TagIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 11.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5L20.5 12.5l-8 8Z" />
    <circle cx="8" cy="8" r="1.2" />
  </Icon>
);

export const SwipeIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="8" y="4" width="11" height="15" rx="2.5" transform="rotate(8 13.5 11.5)" />
    <path d="M6.5 6 4.3 15.6a2 2 0 0 0 1.5 2.4l1.7.4" />
  </Icon>
);

export const NetworkIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="5.5" r="2.5" />
    <circle cx="5.5" cy="18" r="2.5" />
    <circle cx="18.5" cy="18" r="2.5" />
    <path d="M10.8 7.7 6.8 15.8M13.2 7.7l4 8.1M8 18h8" />
  </Icon>
);

export const ThermometerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 13.5V5.5a2 2 0 0 1 4 0v8a4.2 4.2 0 1 1-4 0Z" />
    <path d="M12 10v6" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h9M18 7h2M4 17h2M11 17h9" />
    <circle cx="15.5" cy="7" r="2.5" />
    <circle cx="8.5" cy="17" r="2.5" />
  </Icon>
);

export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7M10 12h11M17.5 8.5 21 12l-3.5 3.5" />
  </Icon>
);

export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CollapseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m12 7-5 5 5 5M18 7l-5 5 5 5" />
  </Icon>
);

export const ChevronIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const ExpandIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const LogoMark = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
  </Icon>
);

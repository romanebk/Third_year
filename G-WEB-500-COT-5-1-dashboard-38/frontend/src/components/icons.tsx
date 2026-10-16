"use client";

// Icônes du site = Font Awesome (demande explicite), rendues derrière la même
// API qu'avant : les composants exportés gardent leur nom et acceptent les
// props SVG habituelles (className, style…), donc aucun appelant ne change.
// Les classes Tailwind `size-*` / `h-* w-*` passées en className restent
// prioritaires sur la taille par défaut de Font Awesome (1em).
//
// La CSS de Font Awesome est importée une seule fois dans layout.tsx — on
// coupe l'injection automatique pour éviter un doublon de styles.

import {
  faArrowDown,
  faArrowRight,
  faArrowUp,
  faArrowUpRightFromSquare,
  faBars,
  faBookOpen,
  faCalendarDays,
  faCheck,
  faCircleExclamation,
  faCloud,
  faCloudBolt,
  faCloudMoon,
  faCloudRain,
  faCodeCommit,
  faCoins,
  faCube,
  faEllipsisVertical,
  faEnvelope,
  faEye,
  faEyeSlash,
  faGamepad,
  faGear,
  faGripVertical,
  faGraduationCap,
  faLocationArrow,
  faLocationDot,
  faMoneyBillWave,
  faMoon,
  faPause,
  faPen,
  faPlus,
  faPlay,
  faRightFromBracket,
  faRotateRight,
  faRocket,
  faRss,
  faShieldHalved,
  faSnowflake,
  faSpinner,
  faSun,
  faTableCells,
  faTableCellsLarge,
  faTrash,
  faUser,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faYoutube } from "@fortawesome/free-brands-svg-icons";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faLocationCrosshairs } from "@fortawesome/free-solid-svg-icons";
import { config, type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import type { SVGProps } from "react";

config.autoAddCss = false;

type IconProps = SVGProps<SVGSVGElement>;

function Fa({ icon, className, style, "aria-hidden": ariaHidden }: IconProps & { icon: IconDefinition }) {
  return (
    <FontAwesomeIcon
      icon={icon}
      className={className}
      style={style as FontAwesomeIconProps["style"]}
      aria-hidden={ariaHidden ?? "true"}
    />
  );
}

export function EyeIcon(props: IconProps) {
  return <Fa icon={faEye} {...props} />;
}

export function EyeOffIcon(props: IconProps) {
  return <Fa icon={faEyeSlash} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <Fa icon={faCheck} {...props} />;
}

export function MailIcon(props: IconProps) {
  return <Fa icon={faEnvelope} {...props} />;
}

export function GithubIcon(props: IconProps) {
  return <Fa icon={faGithub} {...props} />;
}

export function YoutubeIcon(props: IconProps) {
  return <Fa icon={faYoutube} {...props} />;
}

export function ArrowRightIcon(props: IconProps) {
  return <Fa icon={faArrowRight} {...props} />;
}

export function ArrowUpIcon(props: IconProps) {
  return <Fa icon={faArrowUp} {...props} />;
}

export function ArrowDownIcon(props: IconProps) {
  return <Fa icon={faArrowDown} {...props} />;
}

export function MenuIcon(props: IconProps) {
  return <Fa icon={faBars} {...props} />;
}

export function CloseIcon(props: IconProps) {
  return <Fa icon={faXmark} {...props} />;
}

export function CloudIcon(props: IconProps) {
  return <Fa icon={faCloud} {...props} />;
}

export function CloudMoonIcon(props: IconProps) {
  return <Fa icon={faCloudMoon} {...props} />;
}

export function MoonIcon(props: IconProps) {
  return <Fa icon={faMoon} {...props} />;
}

export function RssIcon(props: IconProps) {
  return <Fa icon={faRss} {...props} />;
}

export function GamepadIcon(props: IconProps) {
  return <Fa icon={faGamepad} {...props} />;
}

export function CoinsIcon(props: IconProps) {
  return <Fa icon={faCoins} {...props} />;
}

export function EllipsisIcon(props: IconProps) {
  return <Fa icon={faEllipsisVertical} {...props} />;
}

export function PlusIcon(props: IconProps) {
  return <Fa icon={faPlus} {...props} />;
}

export function ExternalLinkIcon(props: IconProps) {
  return <Fa icon={faArrowUpRightFromSquare} {...props} />;
}

export function TrashIcon(props: IconProps) {
  return <Fa icon={faTrash} {...props} />;
}

export function GripIcon(props: IconProps) {
  return <Fa icon={faGripVertical} {...props} />;
}

export function SpinnerIcon(props: IconProps) {
  return <Fa icon={faSpinner} {...props} />;
}

export function LayoutDashboardIcon(props: IconProps) {
  return <Fa icon={faTableCellsLarge} {...props} />;
}

export function LayoutGridIcon(props: IconProps) {
  return <Fa icon={faTableCells} {...props} />;
}

export function LogOutIcon(props: IconProps) {
  return <Fa icon={faRightFromBracket} {...props} />;
}

export function MapPinIcon(props: IconProps) {
  return <Fa icon={faLocationDot} {...props} />;
}

export function CurrencyIcon(props: IconProps) {
  return <Fa icon={faMoneyBillWave} {...props} />;
}

export function WikiIcon(props: IconProps) {
  return <Fa icon={faBookOpen} {...props} />;
}

export function SunIcon(props: IconProps) {
  return <Fa icon={faSun} {...props} />;
}

export function CloudRainIcon(props: IconProps) {
  return <Fa icon={faCloudRain} {...props} />;
}

export function CloudSnowIcon(props: IconProps) {
  return <Fa icon={faSnowflake} {...props} />;
}

export function CloudLightningIcon(props: IconProps) {
  return <Fa icon={faCloudBolt} {...props} />;
}

export function GitCommitIcon(props: IconProps) {
  return <Fa icon={faCodeCommit} {...props} />;
}

export function CubeIcon(props: IconProps) {
  return <Fa icon={faCube} {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <Fa icon={faGear} {...props} />;
}

export function RefreshIcon(props: IconProps) {
  return <Fa icon={faRotateRight} {...props} />;
}

export function PlayIcon(props: IconProps) {
  return <Fa icon={faPlay} {...props} />;
}

export function PauseIcon(props: IconProps) {
  return <Fa icon={faPause} {...props} />;
}

export function PenIcon(props: IconProps) {
  return <Fa icon={faPen} {...props} />;
}

export function UserIcon(props: IconProps) {
  return <Fa icon={faUser} {...props} />;
}

export function ShieldIcon(props: IconProps) {
  return <Fa icon={faShieldHalved} {...props} />;
}

export function GoogleIcon(props: IconProps) {
  return <Fa icon={faGoogle} {...props} />;
}

export function LocateIcon(props: IconProps) {
  return <Fa icon={faLocationCrosshairs} {...props} />;
}

export function AlertIcon(props: IconProps) {
  return <Fa icon={faCircleExclamation} {...props} />;
}

export function CalendarIcon(props: IconProps) {
  return <Fa icon={faCalendarDays} {...props} />;
}

export function RocketIcon(props: IconProps) {
  return <Fa icon={faRocket} {...props} />;
}

export function GraduationIcon(props: IconProps) {
  return <Fa icon={faGraduationCap} {...props} />;
}

export function LocationArrowIcon(props: IconProps) {
  return <Fa icon={faLocationArrow} {...props} />;
}

"use client";

import {
  CloudIcon,
  GamepadIcon,
  GithubIcon,
  RssIcon,
} from "@/components/icons";
import ResponsiveHeroBanner from "@/components/ui/responsive-hero-banner";

const HERO_PROPS = {
  badgeLabel: "New",
  badgeText: "Widgets for your GitHub, Steam, weather and RSS",
  title: "Your dashboard,",
  titleLine2: "built around your workflow",
  description:
    "Gather GitHub, Steam, weather and RSS widgets in one place. Subscribe to the services you use, then arrange your widgets any way you want.",
  primaryButtonText: "Get started",
  primaryButtonHref: "/register",
  secondaryButtonText: "Explore services",
  secondaryButtonHref: "/services",
  ctaButtonText: "Sign in",
  ctaButtonHref: "/login",
  logoUrl: "/logos/logo-navbar-white.png",
  logoHref: "/dashboard",
  navLinks: [
    { label: "Getting started", href: "#getting-started", isActive: true },
    { label: "Services", href: "/services" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  partnersTitle: "One place for the services you already use",
  partners: [
    { href: "/services", label: "GitHub", Icon: <GithubIcon className="size-6" /> },
    { href: "/services", label: "Steam", Icon: <GamepadIcon className="size-6" /> },
    { href: "/services", label: "Weather", Icon: <CloudIcon className="size-6" /> },
    { href: "/services", label: "RSS", Icon: <RssIcon className="size-6" /> },
  ],
};

export default function SaaSTemplate({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div id="getting-started">
        <ResponsiveHeroBanner
          {...HERO_PROPS}
          ctaButtonText={isLoggedIn ? "Dashboard" : HERO_PROPS.ctaButtonText}
          ctaButtonHref={isLoggedIn ? "/dashboard" : HERO_PROPS.ctaButtonHref}
        />
      </div>
    </main>
  );
}
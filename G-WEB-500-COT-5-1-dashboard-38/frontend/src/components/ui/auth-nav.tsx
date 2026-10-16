import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/settings", label: "Settings" },
];

export function AuthNav({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <nav
      className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm sm:px-6"
      aria-label="Site"
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
        aria-label="Hubly home"
      >
        <Image
          src="/logos/logo-navbar-white.png"
          alt=""
          width={128}
          height={32}
          unoptimized
          className="size-7 object-cover [object-position:55%_50%]"
        />
        <span className="text-sm font-semibold tracking-tight">Hubly</span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="hidden items-center justify-center rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] min-w-[44px] sm:inline-flex"
          >
            {label}
          </Link>
        ))}
        <Link
          href={ctaHref}
          className="inline-flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {ctaLabel}
        </Link>
      </div>
    </nav>
  );
}
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";

import {
  CubeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboardIcon },
  { label: "Services", href: "/services", Icon: CubeIcon },
  { label: "Profile", href: "/profile", Icon: UserIcon },
  { label: "Settings", href: "/settings", Icon: SettingsIcon },
];

// Retiré par erreur du menu (cf. rapport.md F-Admin) : la route /admin et son
// garde serveur (requireAdmin) fonctionnaient toujours, seul le point d'accès
// UI avait disparu — un non-admin qui cliquerait dessus était de toute façon
// redirigé côté serveur, donc l'afficher seulement aux admins est une
// amélioration UX, pas le vrai garde-fou (qui reste requireAdmin/l'API).
const ADMIN_LINK = { label: "Admin", href: "/admin", Icon: ShieldIcon };

function Brand() {
  const { open, animate } = useSidebar();
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center gap-2 py-3 text-sm font-medium text-foreground min-h-[48px] rounded-md px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Hubly home"
    >
      <span className="flex items-center justify-center min-h-[40px] min-w-[40px] flex-shrink-0">
        <Image
          src="/logos/logo-navbar-white.png"
          alt=""
          width={128}
          height={32}
          unoptimized
          className="h-6 w-6 object-cover [object-position:55%_50%]"
        />
      </span>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
          width: animate ? (open ? "auto" : "0px") : "auto",
        }}
        className="inline-block whitespace-pre transition-all duration-200 overflow-hidden"
      >
        Hubly
      </motion.span>
    </Link>
  );
}

export function DashboardShell({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navLinks = isAdmin ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background md:flex-row">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-8">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Brand />
            <nav className="mt-3 flex flex-col gap-1" aria-label="Main navigation">
              {navLinks.map(({ label, href, Icon }) => (
                <SidebarLink
                  key={href}
                  link={{
                    label,
                    href,
                    icon: <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />,
                  }}
                />
              ))}
            </nav>
          </div>
          <div className="flex flex-col gap-1">
            <SidebarLink
              link={{
                label: "Logout",
                href: "/login",
                icon: <LogOutIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />,
              }}
              onClick={(event) => {
                // href="/login" reste comme repli non-JS ; en usage normal on
                // intercepte pour appeler signOut(), sans quoi ce lien ne
                // faisait que naviguer sans jamais invalider la session
                // NextAuth (le cookie JWT restait valide 30 jours).
                event.preventDefault();
                void signOut({ callbackUrl: "/login" });
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-background px-4 py-6 outline-none md:px-6 md:py-8 lg:px-8",
        )}
      >
        {children}
      </main>
    </div>
  );
}
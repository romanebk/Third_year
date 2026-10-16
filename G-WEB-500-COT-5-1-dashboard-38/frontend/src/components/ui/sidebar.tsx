"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CloseIcon, MenuIcon } from "@/components/icons";

export interface SidebarLinkItem {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export function useSidebar(): SidebarContextProps {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
}

export function SidebarBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <DesktopSidebar className={className}>
        {children}
      </DesktopSidebar>
      <MobileSidebar className={className}>
        {children}
      </MobileSidebar>
    </>
  );
}

export function DesktopSidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "hidden h-full flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-300 md:flex overflow-hidden",
        className,
      )}
      animate={{
        width: animate ? (open ? "240px" : "64px") : "240px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
    >
      <div className={cn(
        "flex flex-col h-full w-full transition-all duration-300",
        animate ? (open ? "px-3" : "px-2") : "px-3",
      )}>
        {children}
      </div>
    </motion.div>
  );
}

export function MobileSidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen } = useSidebar();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelCloseRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      panelCloseRef.current?.focus();
    } else {
      document.body.style.overflow = "";
      if (wasOpen.current) triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Piège de focus au clavier : sans lui, Tab depuis "Close menu" (le dernier
  // élément du panneau) sortait vers le <main> derrière l'overlay, resté
  // atteignable au clavier malgré le fond assombri — même correctif que
  // AddWidgetDialog/EditWidgetDialog dans dashboard-overview.tsx, trouvé
  // manquant ici lors d'un audit d'accessibilité.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  return (
    <>
      <div
        className={cn(
          "flex w-full flex-row items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden",
          className,
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-foreground"
          aria-label="Hubly dashboard"
        >
          <Image
            src="/logos/logo-navbar-white.png"
            alt=""
            width={128}
            height={32}
            unoptimized
            className="h-6 w-6 flex-shrink-0 object-cover [object-position:55%_50%]"
          />
          <span className="whitespace-pre">Hubly</span>
        </Link>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="hubly-mobile-nav"
          className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MenuIcon className="h-5 w-5 text-foreground" />
        </button>
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="fixed inset-0 z-[99] bg-black/50"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <motion.div
                ref={panelRef}
                id="hubly-mobile-nav"
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="fixed inset-0 z-[100] flex h-full w-full flex-col justify-between bg-background p-4"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                <button
                  ref={panelCloseRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="absolute top-4 right-4 flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CloseIcon className="h-5 w-5 text-foreground" />
                </button>
                {children}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export function SidebarLink({
  link,
  className,
  ...props
}: {
  link: SidebarLinkItem;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "href">) {
  const { open, animate } = useSidebar();
  return (
    <Link
      href={link.href}
      aria-label={link.label}
      title={link.label}
      className={cn(
        "group/sidebar flex items-center justify-start gap-2 py-2 px-2 rounded-md min-h-[40px] transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <span className="flex items-center justify-center min-h-[40px] min-w-[40px] flex-shrink-0">
        {link.icon}
      </span>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
          width: animate ? (open ? "auto" : "0px") : "auto",
        }}
        className="inline-block text-sm whitespace-pre text-foreground transition-all duration-200 group-hover/sidebar:translate-x-1 overflow-hidden"
      >
        {link.label}
      </motion.span>
    </Link>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "@/components/dashboard-grid.css";

import { CloudIcon } from "@/components/icons";
import { formatRefreshRate, serviceTheme, widgetLabel, widgetSubtitle } from "@/lib/service-theme";
import InstanceWidget from "@/components/widgets/instance-widget";
import TimeCard from "@/components/widgets/time-card";
import TimerCard from "@/components/widgets/timer-card";
import { SERVICE_ICONS } from "@/components/ui/service-card";
import { AddWidgetDialog } from "@/components/dashboard/add-widget-dialog";
import { EditWidgetDialog } from "@/components/dashboard/edit-widget-dialog";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmptyDashboard } from "@/components/dashboard/empty-state";
import { Panel } from "@/components/dashboard/panel";
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_MARGIN,
  GRID_ROW_HEIGHT,
  LAYOUT_STORAGE_KEY,
  defaultLayouts,
  findFreeSlot,
  loadLayouts,
  persistLayouts,
  sizeFor,
  type GridLayouts,
} from "@/components/dashboard/grid";
import { useWidgetData } from "@/components/dashboard/use-widget-data";
import { autoDetectWeatherLocation } from "@/components/dashboard/weather-location";
import type { CustomPanel } from "@/components/dashboard/types";
import type { CreatedWidgetInstance } from "@/components/add-widget-form";
import type { UpdatedWidgetInstance } from "@/components/edit-widget-form";
import type { ServiceInfo, WidgetInfo } from "@/types";

// Titre lisible du widget ("Current weather") ; ce qui distingue deux instances
// du même widget (Paris / Tokyo) passe en sous-titre, cf. widgetSubtitle.
function instanceTitle(widgetName: string): string {
  return widgetLabel(widgetName);
}

export default function DashboardOverview() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [layouts, setLayouts] = useState<GridLayouts>(defaultLayouts);
  const [panels, setPanels] = useState<CustomPanel[]>([]);
  const panelsRef = useRef<CustomPanel[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<CustomPanel | null>(null);
  // Distingue "pas encore chargé" de "aucun widget" pour l'état vide.
  const [panelsLoaded, setPanelsLoaded] = useState(false);
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    // Calculée côté navigateur (fuseau de l'utilisateur) : un rendu serveur
    // aurait l'heure du conteneur et provoquerait un écart d'hydratation.
    const hour = new Date().getHours();
    setGreeting(hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);
  // Nom d'utilisateur (User.name, saisi à l'inscription) en titre. Lu via
  // /api/profile plutôt que la session : le JWT garde l'ancien nom jusqu'à la
  // prochaine connexion après une modification sur /profile.
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { credentials: "include" })
      .then((response) => (response.ok ? (response.json() as Promise<{ name: string | null }>) : null))
      .then((profile) => {
        if (!cancelled && profile?.name) setUsername(profile.name);
      })
      .catch(() => {
        // Titre générique conservé si le profil est indisponible.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const { width, containerRef, mounted: widthReady } = useContainerWidth({ initialWidth: 1200 });
  const layoutsRef = useRef(layouts);
  const editingRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const servicesState = useWidgetData<unknown[]>("/api/services", "services");

  const appliedSavedRef = useRef(false);
  useEffect(() => {
    if (!widthReady || appliedSavedRef.current) return;
    appliedSavedRef.current = true;
    const saved = loadLayouts();
    layoutsRef.current = saved;
    setLayouts(saved);
  }, [widthReady]);

  // Instances de widgets de l'utilisateur — la seule source des panneaux : le GET
  // /api/dashboard crée au besoin les instances par défaut du compte (weather +
  // rss, cf. backend), puis sert la liste (service/widget/params/id en base). La
  // géométrie de grille reste en localStorage (findFreeSlot ci-dessous), mais
  // l'existence/la config d'une instance est 100 % côté serveur.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          defaultsSeeded?: boolean;
          instances: Array<{
            id: string;
            service: string;
            widget: string;
            params: Record<string, string | number>;
            refreshRateSeconds: number;
          }>;
        };
        if (cancelled) return;

        // Compte tout juste créé (le GET vient de créer les instances par défaut) :
        // on auto-détecte la localisation une seule fois — le navigateur demande la
        // géolocalisation, la ville est résolue côté serveur (POST /api/settings/locate)
        // puis refetch pour que les widgets météo affichent la bonne ville, avec Paris
        // en secours si l'utilisateur refuse le partage de position.
        if (body.defaultsSeeded === true) {
          autoDetectWeatherLocation(() => setRefreshKey((key) => key + 1));
        }

        const next: CustomPanel[] = body.instances.map((instance) => ({
          id: instance.id,
          service: instance.service,
          widget: instance.widget,
          title: instanceTitle(instance.widget),
          params: instance.params,
          refreshRateSeconds: instance.refreshRateSeconds,
        }));
        setPanels(next);
        panelsRef.current = next;
        setPanelsLoaded(true);

        // Une instance chargée pour la première fois dans ce navigateur (pas déjà
        // dans le layout sauvegardé) : on lui donne une place par défaut.
        setLayouts((current) => {
          const missing = next.filter((panel) => !current.lg.some((item) => item.i === panel.id));
          if (missing.length === 0) return current;
          const lg = [...current.lg];
          const md = [...current.md];
          const sm = [...current.sm];
          const xs = [...current.xs];
          for (const panel of missing) {
            const lgSize = sizeFor(panel.widget, "lg");
            const mdSize = sizeFor(panel.widget, "md");
            const smSize = sizeFor(panel.widget, "sm");
            const xsSize = sizeFor(panel.widget, "xs");
            // Première place libre pour tous : l'ancien placement forcé du fil
            // d'actualités en haut à droite entrait en collision avec les
            // widgets larges (prévision météo) et finissait repoussé en bas.
            const lgSlot = findFreeSlot(lg, lgSize.w, lgSize.h, GRID_COLS.lg);
            lg.push({ i: panel.id, ...lgSlot, ...lgSize, minW: 3, minH: 3 });
            md.push({ i: panel.id, ...findFreeSlot(md, mdSize.w, mdSize.h, GRID_COLS.md), ...mdSize, minW: 3, minH: 3 });
            sm.push({ i: panel.id, ...findFreeSlot(sm, smSize.w, smSize.h, GRID_COLS.sm), ...smSize, minW: 2, minH: 3 });
            xs.push({ i: panel.id, ...findFreeSlot(xs, xsSize.w, xsSize.h, GRID_COLS.xs), ...xsSize, minH: 3 });
          }
          const nextLayouts: GridLayouts = { lg, md, sm, xs };
          layoutsRef.current = nextLayouts;
          return nextLayouts;
        });
      })
      .catch(() => {
        // Pas connecté ou API indisponible : rien à afficher tant que les
        // instances n'ont pas chargé.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function toggleEditing() {
    const next = !editingRef.current;
    editingRef.current = next;
    setEditing(next);
  }

  // Après un déplacement, PATCH la position (l'ordre, pas x/y — cf. le backend)
  // de chaque instance concernée, dans l'ordre de lecture (y puis x) de la grille
  // "lg".
  function syncCustomPositions(lgItems: Layout) {
    const customIds = new Set(panelsRef.current.map((panel) => panel.id));
    const ordered = [...lgItems]
      .filter((item) => customIds.has(item.i))
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

    ordered.forEach((item, index) => {
      void fetch(`/api/dashboard/${item.i}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: index }),
      }).catch(() => {
        // Best-effort : un échec ici ne doit pas bloquer l'édition du layout.
      });
    });
  }

  // Équivalent clavier du drag-and-drop (react-grid-layout n'en a pas) :
  // échange les coordonnées de ce panneau avec son voisin dans l'ordre de
  // lecture (y puis x, la grille "lg"), puis persiste exactement comme un
  // drag souris (même storage, même sync de position serveur) — trouvé
  // manquant lors d'un audit d'accessibilité.
  const movePanel = useCallback((id: string, direction: "up" | "down") => {
    const customIds = new Set(panelsRef.current.map((panel) => panel.id));
    const currentLg = layoutsRef.current.lg;
    const ordered = [...currentLg]
      .filter((item) => customIds.has(item.i))
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

    const index = ordered.findIndex((item) => item.i === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const current = ordered[index];
    const target = ordered[targetIndex];
    const nextLg = currentLg.map((item) => {
      if (item.i === current.i) return { ...item, x: target.x, y: target.y };
      if (item.i === target.i) return { ...item, x: current.x, y: current.y };
      return item;
    });

    const nextLayouts: GridLayouts = { ...layoutsRef.current, lg: nextLg };
    layoutsRef.current = nextLayouts;
    setLayouts(nextLayouts);
    persistLayouts(nextLayouts);
    syncCustomPositions(nextLg);
  }, []);

  function handleLayoutChange(_current: Layout, all: ResponsiveLayouts<string>) {
    const next: GridLayouts = {
      lg: (all.lg as Layout | undefined) ?? layoutsRef.current.lg,
      md: (all.md as Layout | undefined) ?? layoutsRef.current.md,
      sm: (all.sm as Layout | undefined) ?? layoutsRef.current.sm,
      xs: (all.xs as Layout | undefined) ?? layoutsRef.current.xs,
    };
    layoutsRef.current = next;
    setLayouts(next);
    if (editingRef.current) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        persistLayouts(next);
        syncCustomPositions(next.lg);
      }, 300);
    }
  }

  function resetLayout() {
    try {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
    const reset = defaultLayouts();
    layoutsRef.current = reset;
    setLayouts(reset);
  }

  const removePanel = useCallback((id: string) => {
    setPanels((current) => {
      const next = current.filter((panel) => panel.id !== id);
      panelsRef.current = next;
      return next;
    });
    setLayouts((current) => ({
      lg: current.lg.filter((item) => item.i !== id),
      md: current.md.filter((item) => item.i !== id),
      sm: current.sm.filter((item) => item.i !== id),
      xs: current.xs.filter((item) => item.i !== id),
    }));
    void fetch(`/api/dashboard/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {
      // Best-effort : déjà retiré de l'UI ; un échec réseau isolé ne doit pas
      // faire réapparaître le panneau.
    });
  }, []);

  // Appelé une fois l'instance réellement créée côté API (AddWidgetForm a déjà
  // fait le POST /api/dashboard).
  const handleInstanceCreated = useCallback((instance: CreatedWidgetInstance) => {
    const panel: CustomPanel = {
      id: instance.id,
      service: instance.service,
      widget: instance.widget,
      title: instanceTitle(instance.widget),
      params: instance.params,
      refreshRateSeconds: instance.refreshRateSeconds,
    };
    setPanels((current) => {
      const next = [...current, panel];
      panelsRef.current = next;
      return next;
    });
    setLayouts((current) => {
      const id = instance.id;
      if (current.lg.some((item) => item.i === id)) return current;
      const lg: Layout[number] = { i: id, x: 0, y: 0, ...sizeFor(instance.widget, "lg"), minW: 3, minH: 3 };
      const md: Layout[number] = { i: id, x: 0, y: 0, ...sizeFor(instance.widget, "md"), minW: 3, minH: 3 };
      const sm: Layout[number] = { i: id, x: 0, y: 0, ...sizeFor(instance.widget, "sm"), minW: 2, minH: 3 };
      const xs: Layout[number] = { i: id, x: 0, y: 0, ...sizeFor(instance.widget, "xs"), minH: 3 };
      const next = {
        lg: [...current.lg, { ...lg, ...findFreeSlot(current.lg, lg.w, lg.h, GRID_COLS.lg) }],
        md: [...current.md, { ...md, ...findFreeSlot(current.md, md.w, md.h, GRID_COLS.md) }],
        sm: [...current.sm, { ...sm, ...findFreeSlot(current.sm, sm.w, sm.h, GRID_COLS.sm) }],
        xs: [...current.xs, { ...xs, ...findFreeSlot(current.xs, xs.w, xs.h, GRID_COLS.xs) }],
      };
      layoutsRef.current = next;
      persistLayouts(next);
      return next;
    });
    setAddOpen(false);
  }, []);

  // Widget de catalogue (nom/description/params) correspondant à un panneau —
  // vient de /api/services (déjà chargé pour AddWidgetDialog), pas dupliqué.
  const widgetInfoFor = useCallback(
    (panel: CustomPanel): WidgetInfo | undefined => {
      if (servicesState.status !== "ready") return undefined;
      const services = servicesState.data as ServiceInfo[];
      return services
        .find((service) => service.name === panel.service)
        ?.widgets.find((widget) => widget.name === panel.widget);
    },
    [servicesState],
  );

  const handleInstanceUpdated = useCallback((instance: UpdatedWidgetInstance) => {
    setPanels((current) => {
      const next = current.map((panel) =>
        panel.id === instance.id
          ? {
              ...panel,
              params: instance.params,
              refreshRateSeconds: instance.refreshRateSeconds,
              title: instanceTitle(instance.widget),
            }
          : panel,
      );
      panelsRef.current = next;
      return next;
    });
    setEditingPanel(null);
  }, []);

  const renderPanel = useCallback(
    (panel: CustomPanel, index: number) => {
      const Icon = SERVICE_ICONS[panel.service] ?? CloudIcon;
      return (
        <Panel
          key={panel.id}
          title={panel.title}
          subtitle={widgetSubtitle(panel.service, panel.widget, panel.params)}
          accent={serviceTheme(panel.service).accent}
          live={formatRefreshRate(panel.refreshRateSeconds)}
          index={index}
          fill
          scrollable
          grip={editing}
          editing={editing}
          icon={<Icon className="size-4" />}
          onConfigure={() => setEditingPanel(panel)}
          onRemove={() => removePanel(panel.id)}
          onMoveUp={editing ? () => movePanel(panel.id, "up") : undefined}
          onMoveDown={editing ? () => movePanel(panel.id, "down") : undefined}
        >
          <InstanceWidget
            id={panel.id}
            service={panel.service}
            widget={panel.widget}
            params={panel.params}
            refreshKey={refreshKey}
          />
        </Panel>
      );
    },
    [editing, removePanel, movePanel, refreshKey],
  );

  const visibleIds = useMemo(() => new Set(panels.map((panel) => panel.id)), [panels]);

  const activeLayouts = useMemo<GridLayouts>(
    () => ({
      lg: layouts.lg.filter((item) => visibleIds.has(item.i)),
      md: layouts.md.filter((item) => visibleIds.has(item.i)),
      sm: layouts.sm.filter((item) => visibleIds.has(item.i)),
      xs: layouts.xs.filter((item) => visibleIds.has(item.i)),
    }),
    [layouts, visibleIds],
  );

  const activeServiceCount = new Set(panels.map((panel) => panel.service)).size;

  return (
    // isolate : crée un contexte d'empilement propre, sans quoi les halos en
    // -z-10 passaient derrière le fond noir de <main> et restaient invisibles.
    <div className="relative isolate flex w-full flex-col gap-6">
      <DashboardHeader
        greeting={greeting}
        username={username}
        panelsLoaded={panelsLoaded}
        panelCount={panels.length}
        serviceCount={activeServiceCount}
        editing={editing}
        onResetLayout={resetLayout}
        onRefresh={() => setRefreshKey((key) => key + 1)}
        onToggleEditing={toggleEditing}
        onAdd={() => setAddOpen(true)}
      />

      <div className="flex flex-wrap items-stretch gap-4">
        <TimeCard />
        <TimerCard />
      </div>

      {panelsLoaded && panels.length === 0 ? (
        <EmptyDashboard onAdd={() => setAddOpen(true)} />
      ) : null}

      <div ref={containerRef}>
        {widthReady ? (
          <Responsive
            className={editing ? "w-full rgl-editing" : "w-full"}
            width={width}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            layouts={activeLayouts}
            rowHeight={GRID_ROW_HEIGHT}
            margin={GRID_MARGIN}
            dragConfig={{ enabled: editing, handle: ".rgl-drag-handle", threshold: 3 }}
            resizeConfig={{ enabled: editing }}
            onLayoutChange={handleLayoutChange}
          >
            {panels.map((panel, index) => renderPanel(panel, index))}
          </Responsive>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {panels.map((panel, index) => renderPanel(panel, index))}
          </div>
        )}
      </div>

      <AddWidgetDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        services={servicesState.status === "ready" ? (servicesState.data as ServiceInfo[]) : []}
        onAdd={handleInstanceCreated}
      />

      <EditWidgetDialog
        panel={editingPanel}
        widget={editingPanel ? widgetInfoFor(editingPanel) : undefined}
        minRefreshRateSeconds={
          editingPanel && servicesState.status === "ready"
            ? (servicesState.data as ServiceInfo[]).find((service) => service.name === editingPanel.service)
                ?.minRefreshRateSeconds
            : undefined
        }
        onClose={() => setEditingPanel(null)}
        onUpdated={handleInstanceUpdated}
      />
    </div>
  );
}

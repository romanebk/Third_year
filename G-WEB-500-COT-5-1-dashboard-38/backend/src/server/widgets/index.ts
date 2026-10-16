import type { WidgetInfo } from "@/types";

import { services } from "@/server/services";

// Registre global des widgets disponibles (tous services confondus).
export function getAllWidgets(): WidgetInfo[] {
  return services.flatMap((service) => service.widgets);
}

export function getWidgetByName(name: string): WidgetInfo | undefined {
  return getAllWidgets().find((widget) => widget.name === name);
}
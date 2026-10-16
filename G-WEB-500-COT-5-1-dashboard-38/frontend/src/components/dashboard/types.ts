export interface CustomPanel {
  id: string;
  service: string;
  widget: string;
  title: string;
  params: Record<string, string | number>;
  refreshRateSeconds: number;
}

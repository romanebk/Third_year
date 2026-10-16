import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hubly",
    short_name: "Hubly",
    description: "Personal customizable dashboard",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/logos/icon-16.png", sizes: "16x16", type: "image/png" },
      { src: "/logos/icon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/logos/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logos/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
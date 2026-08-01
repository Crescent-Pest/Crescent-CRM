import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crescent CRM",
    short_name: "Crescent",
    description: "Customer and scheduling hub for Crescent Pest Control",
    start_url: "/today",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#1d2a42",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

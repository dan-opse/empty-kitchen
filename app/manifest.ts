import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meal Plan",
    short_name: "Meal Plan",
    description: "Turn a grocery trip into a week of lunch and dinner.",
    start_url: "/",
    display: "standalone",
    background_color: "#e4ebf0",
    theme_color: "#005A54",
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

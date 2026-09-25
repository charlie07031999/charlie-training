import type { MetadataRoute } from "next";

export default function manifest():MetadataRoute.Manifest{
  return {
    id:"/nous",
    name:"NOUS — notre vie à deux",
    short_name:"NOUS",
    description:"Listes, agenda, idées, courses et pense-bêtes partagés à deux.",
    start_url:"/nous",
    scope:"/nous",
    display:"standalone",
    background_color:"#f5efe7",
    theme_color:"#f5efe7",
    orientation:"portrait",
    icons:[{
      src:"/nous-icon.svg",
      sizes:"any",
      type:"image/svg+xml",
      purpose:"any"
    }]
  };
}

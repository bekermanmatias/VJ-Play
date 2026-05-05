export type DemoClip = {
  id: string;
  label: string;
  at: number;
  thumb: string;
  /** URL del archivo del clip; si falta, en descarga se usa la fuente del partido. */
  downloadHref?: string;
};

const demoClipFile =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const DEMO_CLIPS: DemoClip[] = [
  {
    id: "1",
    label: "Punto 1",
    at: 12,
    thumb:
      "https://images.unsplash.com/photo-1627615922102-6b7ef5f0ec55?auto=format&fit=crop&w=400&q=60",
    downloadHref: demoClipFile,
  },
  {
    id: "2",
    label: "Saque",
    at: 45,
    thumb:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=400&q=60",
    downloadHref: demoClipFile,
  },
  {
    id: "3",
    label: "Defensa",
    at: 88,
    thumb:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=400&q=60",
    downloadHref: demoClipFile,
  },
];

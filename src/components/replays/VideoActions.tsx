import { Download, Scissors, Share2 } from "lucide-react";

type Props = {
  variant?: "light" | "dark";
};

export default function VideoActions({ variant = "light" }: Props) {
  const items = [
    {
      label: "Descargar",
      icon: Download,
      href: "#",
    },
    {
      label: "Recortar clip",
      icon: Scissors,
      href: "#",
    },
    {
      label: "Compartir",
      icon: Share2,
      href: "#",
    },
  ];

  const shell =
    variant === "dark"
      ? "border border-white/10 bg-slate-900 p-3 sm:p-4"
      : "border border-t-0 border-slate-200 bg-white p-3 sm:p-4";

  const link =
    variant === "dark"
      ? "inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wide text-white/85 transition-colors hover:border-vj-green hover:text-vj-green"
      : "inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-700 transition-colors hover:border-vj-green hover:text-vj-green";

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={item.href}
              className={link}
            >
              <Icon size={16} strokeWidth={2.2} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  fetchPublicNews,
  newsCategoryLabel,
  newsDate,
  newsHref,
  newsImageOrPlaceholder,
  type News,
} from "@/utils/news-api";

type Props = {
  apiBase: string;
  initialNews: News[];
  initialTotal: number;
  initialPage?: number;
  pageSize: number;
  categorySlug?: string;
  search?: string;
};

export default function NewsLoadMoreList({
  apiBase,
  initialNews,
  initialTotal,
  initialPage = 1,
  pageSize,
  categorySlug,
  search,
}: Props) {
  const [items, setItems] = useState(initialNews);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = items.length < total;

  const handleLoadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const result = await fetchPublicNews(apiBase, {
        categorySlug,
        search,
        limit: pageSize,
        page: nextPage,
      });

      if (result.news.length === 0) {
        setError("No se pudieron cargar más noticias.");
        return;
      }

      setItems((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const nextItems = result.news.filter((n) => !existingIds.has(n.id));
        return [...prev, ...nextItems];
      });
      setTotal(result.total || total);
      setPage(nextPage);
    } catch {
      setError("No se pudieron cargar más noticias.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => (
          <article
            key={n.id}
            className="group flex flex-col overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <a href={newsHref(n)} className="block">
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                <img
                  src={newsImageOrPlaceholder(n)}
                  alt={n.images[0]?.altText ?? n.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </a>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-vj-green">
                  {newsCategoryLabel(n)}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{newsDate(n)}</span>
              </div>
              <h2 className="mt-2 text-lg font-extrabold leading-snug text-slate-900">
                <a href={newsHref(n)} className="hover:underline">
                  {n.title}
                </a>
              </h2>
              {n.summary && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
                  {n.summary}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-xs text-slate-500">
          Mostrando {items.length} de {total}
        </p>

        {hasMore && (
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:border-vj-green hover:text-vj-green disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando
              </>
            ) : (
              <>
                Ver más
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </>
  );
}

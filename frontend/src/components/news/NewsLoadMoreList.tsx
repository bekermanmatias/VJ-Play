import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { fetchPublicNews, type News } from "@/utils/news-api";
import NewsCard from "./NewsCard";

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
        {items.map((n) => <NewsCard key={n.id} news={n} />)}
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

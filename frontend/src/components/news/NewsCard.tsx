import { newsCategoryLabel, newsDate, newsHref, newsImageOrPlaceholder, type News } from "@/utils/news-api";
import ImageFallback from "@/components/ui/ImageFallback";

export default function NewsCard({ news }: { news: News }) {
  return (
    <article className="group flex flex-col overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <a href={newsHref(news)} className="block">
        <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <ImageFallback src={newsImageOrPlaceholder(news)} alt={news.images[0]?.altText ?? news.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
        </div>
      </a>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-vj-green">{newsCategoryLabel(news)}</span>
          <span className="shrink-0 text-[11px] text-slate-400">{newsDate(news)}</span>
        </div>
        <h3 className="mt-2 text-lg font-extrabold leading-snug text-slate-900"><a href={newsHref(news)} className="hover:underline">{news.title}</a></h3>
        {news.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{news.summary}</p>}
      </div>
    </article>
  );
}

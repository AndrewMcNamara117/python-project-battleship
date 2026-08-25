import { AppPage } from '@/components/app/PageHeader';

/**
 * Premium loading state: the real layout in skeleton, so nothing jumps on arrival.
 *
 * Placement matters. A `loading.tsx` creates a Suspense boundary for its segment
 * *and every child*, which flushes the response early — and once the response has
 * flushed, a child calling notFound() can no longer set a 404 status. So these
 * live on leaf segments only, never above a dynamic route that needs notFound().
 */
export function PageSkeleton() {
  return (
    <AppPage>
      <div className="border-b border-line pb-7">
        <div className="im-skeleton h-3 w-32 rounded-xs" />
        <div className="im-skeleton mt-4 h-9 w-72 rounded-xs" />
        <div className="im-skeleton mt-4 h-3.5 w-full max-w-[46ch] rounded-xs" />
      </div>

      <div className="mt-9 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="im-skeleton h-72 rounded-sm" />
        <div className="space-y-5">
          <div className="im-skeleton h-32 rounded-sm" />
          <div className="im-skeleton h-32 rounded-sm" />
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="im-skeleton h-36 rounded-sm" />
        ))}
      </div>

      <span className="sr-only">Loading</span>
    </AppPage>
  );
}

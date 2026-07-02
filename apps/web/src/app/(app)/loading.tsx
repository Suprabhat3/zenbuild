import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state for every page under the app shell. Mirrors the
 * common page anatomy (eyebrow → title → lede → content panel) so navigation
 * feels instant instead of showing a blank content area.
 */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <div className="app-page-header">
        <Skeleton className="mb-3 h-4 w-24" />
        <Skeleton className="mb-2 h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="app-panel mt-6 space-y-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="grid gap-4 pt-2 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}

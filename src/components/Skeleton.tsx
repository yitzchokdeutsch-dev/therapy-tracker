export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-surface-200 animate-pulse rounded ${className}`} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-surface-200">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

export function SkeletonCheckinCard() {
  return (
    <div className="card mb-4 overflow-hidden">
      <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center gap-3">
        <Skeleton className="h-3.5 w-3.5 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-5 py-3 border-b border-surface-200 last:border-0 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-8 w-20 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-4">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-8 w-16 mb-1.5" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

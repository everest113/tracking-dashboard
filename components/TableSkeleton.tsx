export default function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Tabs skeleton */}
      <div className="border-b border-gray-200 pb-3">
        <div className="flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 w-20 bg-gray-200 rounded" />
          ))}
        </div>
      </div>

      {/* Search skeleton */}
      <div className="h-10 w-64 bg-gray-200 rounded" />

      {/* Table skeleton */}
      <div className="border rounded-lg">
        {/* Header */}
        <div className="border-b bg-gray-50 p-4">
          <div className="flex gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-4 flex-1 bg-gray-200 rounded" />
            ))}
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-b p-4 last:border-b-0">
            <div className="flex gap-4">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-4 flex-1 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex justify-between items-center pt-4">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-200 rounded" />
          <div className="h-8 w-8 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

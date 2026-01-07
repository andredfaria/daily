import Skeleton from './ui/Skeleton'
import Card from './ui/Card'

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <Card>
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width={80} height={80} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width={200} height={28} />
            <Skeleton variant="text" width={150} height={20} />
            <Skeleton variant="text" width={100} height={16} />
          </div>
        </div>
      </Card>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <div className="space-y-3">
              <Skeleton variant="text" width={120} height={16} />
              <Skeleton variant="text" width={60} height={32} />
              <Skeleton variant="rectangular" width="100%" height={8} />
            </div>
          </Card>
        ))}
      </div>

      {/* Activity Grid Skeleton */}
      <Card>
        <Skeleton variant="text" width={200} height={24} className="mb-4" />
        <div className="grid grid-cols-14 gap-2">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={40} />
          ))}
        </div>
      </Card>

      {/* Table Skeleton */}
      <Card noPadding>
        <div className="p-6 border-b border-slate-200">
          <Skeleton variant="text" width={150} height={20} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[1, 2, 3, 4].map(i => (
                  <th key={i} className="px-6 py-3">
                    <Skeleton variant="text" width={100} height={16} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(row => (
                <tr key={row}>
                  {[1, 2, 3, 4].map(cell => (
                    <td key={cell} className="px-6 py-4">
                      <Skeleton variant="text" width={120} height={20} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

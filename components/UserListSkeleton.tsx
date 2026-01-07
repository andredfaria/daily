import Skeleton from './ui/Skeleton'
import Card from './ui/Card'

export default function UserListSkeleton() {
  return (
    <Card className="overflow-hidden" noPadding>
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={200} height={24} />
          <Skeleton variant="rectangular" width={120} height={40} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <th key={i} className="px-6 py-3">
                  <Skeleton variant="text" width={80} height={16} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {[1, 2, 3, 4, 5].map(row => (
              <tr key={row}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(cell => (
                  <td key={cell} className="px-6 py-4">
                    <Skeleton variant="text" width={cell === 1 ? 60 : cell === 8 ? 150 : 100} height={20} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

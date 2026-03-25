import React from 'react'

interface SkeletonProps {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`shimmer-bg rounded-lg bg-surface-container-high ${className}`} />
)

export const SkeletonCard: React.FC = () => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div>
          <Skeleton className="w-32 h-4 mb-2" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
    <Skeleton className="w-28 h-7 mb-2" />
    <Skeleton className="w-24 h-3" />
  </div>
)

export const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30">
    <Skeleton className="w-1 h-12 rounded-full" />
    <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
    <div className="flex-1">
      <Skeleton className="w-40 h-4 mb-2" />
      <Skeleton className="w-24 h-3" />
    </div>
    <div className="text-right">
      <Skeleton className="w-24 h-5 mb-2" />
      <Skeleton className="w-16 h-3" />
    </div>
    <Skeleton className="w-20 h-7 rounded-full" />
  </div>
)

export const SkeletonStatCard: React.FC = () => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <Skeleton className="w-12 h-5 rounded-full" />
    </div>
    <Skeleton className="w-16 h-8 mb-1" />
    <Skeleton className="w-28 h-3" />
  </div>
)

export default Skeleton

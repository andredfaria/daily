export default function LoadingSpinner({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="text-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="mt-4 text-slate-500">{message}</p>
    </div>
  )
}

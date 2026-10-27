import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-app-bg">
      <main className="pb-20 pt-[max(env(safe-area-inset-top),12px)]">{children}</main>
      <BottomNav />
    </div>
  )
}

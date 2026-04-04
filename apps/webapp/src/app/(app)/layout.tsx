import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { UsageBanner } from '@/components/upgrade/usage-banner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <UsageBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

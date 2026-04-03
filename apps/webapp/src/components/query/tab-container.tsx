'use client'

import { X, Plus } from 'lucide-react'
import { useQueryStore } from '@/stores/query-store'

export function TabContainer() {
  const { tabs, activeTabId, setActiveTab, addTab, removeTab } = useQueryStore()

  return (
    <div className="flex items-center border-b border-border bg-background/50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group flex items-center gap-1.5 px-4 py-2 text-xs transition-colors border-b-2 ${
            tab.id === activeTabId
              ? 'border-accent text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.title}
          {tabs.length > 1 && (
            <X
              className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                removeTab(tab.id)
              }}
            />
          )}
        </button>
      ))}
      <button
        onClick={addTab}
        className="px-3 py-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

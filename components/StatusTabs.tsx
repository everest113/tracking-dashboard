'use client'

interface StatusTabsProps {
  counts: {
    all: number
    pending: number
    infoReceived: number
    inTransit: number
    outForDelivery: number
    failedAttempt: number
    availableForPickup: number
    delivered: number
    exception: number
    trackingErrors: number
  }
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { key: 'all', label: 'All', countKey: 'all' as const },
  { key: 'pending', label: 'Pending', countKey: 'pending' as const },
  { key: 'info_received', label: 'Info Received', countKey: 'infoReceived' as const },
  { key: 'in_transit', label: 'In Transit', countKey: 'inTransit' as const },
  { key: 'out_for_delivery', label: 'Out for Delivery', countKey: 'outForDelivery' as const },
  { key: 'failed_attempt', label: 'Failed Attempt', countKey: 'failedAttempt' as const },
  { key: 'available_for_pickup', label: 'To pick-up', countKey: 'availableForPickup' as const },
  { key: 'delivered', label: 'Delivered', countKey: 'delivered' as const },
  { key: 'exception', label: 'Exception', countKey: 'exception' as const },
  { key: 'trackingErrors', label: 'Tracking Errors', countKey: 'trackingErrors' as const },
]

export default function StatusTabs({ counts, activeTab, onTabChange }: StatusTabsProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Status filter tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          const count = counts[tab.countKey]
          
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                pb-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </nav>
    </div>
  )
}

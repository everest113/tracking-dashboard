'use client'

import { Clock, TruckIcon, AlertTriangle, AlertCircle, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StatusCardsProps {
  summary: {
    total: number
    pending: number
    inTransit: number
    delivered: number
    overdue: number
    exceptions: number
    neverChecked: number
  }
  loading?: boolean
}

interface StatusCard {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}

export default function StatusCards({ summary, loading }: StatusCardsProps) {
  const cards: StatusCard[] = [
    // 🚨 ACTION REQUIRED - Priority metrics that need immediate attention
    {
      label: 'OVERDUE',
      value: summary.overdue,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
    },
    {
      label: 'EXCEPTIONS',
      value: summary.exceptions,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
    },
    {
      label: 'NEVER CHECKED',
      value: summary.neverChecked,
      icon: EyeOff,
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
    },
    // ⚠️ EARLY WARNING - Shipments to monitor
    {
      label: 'PENDING',
      value: summary.pending,
      icon: Clock,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 border-gray-200',
    },
    {
      label: 'IN TRANSIT',
      value: summary.inTransit,
      icon: TruckIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.label}
            className={`border ${card.bgColor} ${loading ? 'opacity-50' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {card.label}
                </span>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className={`text-3xl font-bold ${card.color}`}>
                {loading ? '—' : card.value}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

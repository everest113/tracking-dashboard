'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Package, Truck, MessageSquare } from 'lucide-react'

const navItems = [
  {
    name: 'Shipments',
    href: '/',
    icon: Truck,
    description: 'Track active shipments',
  },
  {
    name: 'Orders',
    href: '/orders',
    icon: Package,
    description: 'View orders and POs',
  },
  {
    name: 'Threads',
    href: '/threads',
    icon: MessageSquare,
    description: 'Review customer threads',
  },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { RefreshFinancialDataButton } from '@/components/ui/refresh-financial-data-button'
import { 
  TrendingUp,
  Target
} from 'lucide-react'

const navigation = [
  { name: 'Breakout Stocks', href: '/', icon: Target },
  { name: 'Data Sources', href: '/admin/sources', icon: TrendingUp },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              {/* Clean navigation without branding */}
            </Link>
            
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Button
                    key={item.name}
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    asChild
                  >
                    <Link href={item.href} className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <RefreshFinancialDataButton />
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

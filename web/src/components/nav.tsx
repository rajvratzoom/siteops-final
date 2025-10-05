'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Truck, AlertTriangle, FileText, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/camera', label: 'Camera', icon: Camera },
  { href: '/people', label: 'People', icon: Users },
  { href: '/machines', label: 'Machines', icon: Truck },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/tickets', label: 'Tickets', icon: FileText },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-64 border-r bg-gray-50 min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">SiteOps</h1>
        <p className="text-sm text-gray-500">Safety MVP</p>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

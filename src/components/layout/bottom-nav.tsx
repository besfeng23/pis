"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  KanbanSquare,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'INTEL', icon: Home },
  { href: '/market', label: 'MARKET', icon: KanbanSquare },
  { href: '/assets', label: 'ASSETS', icon: Users },
  { href: '/ops', label: 'OPS', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-20 border-t border-border bg-card">
      <div className="mx-auto grid h-full max-w-lg grid-cols-4 font-medium">
        {navItems.map(item => {
          const isActive =
            (pathname === '/' && item.href === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group inline-flex flex-col items-center justify-center px-5',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="mb-1 h-6 w-6" />
              <span className="text-xs tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

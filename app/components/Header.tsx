'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import {
  PenLine,
  BookOpen,
  Settings,
  HelpCircle,
  Menu,
  LogOut,
  BarChart3,
  User,
  Home,
  Search,
  MessageCircle,
} from 'lucide-react'
import { useCommandPaletteStore } from '@/lib/commandPaletteStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface HeaderProps {
  /**
   * Retained for backward-compat with a few pages that still pass `title` or
   * `showNav={false}`. The new header is a pure chrome strip; page titles now
   * live in the page body. These props are no-ops visually.
   */
  title?: string
  showNav?: boolean
  /** Deprecated — kept only so existing call sites don't break. */
  showGreeting?: boolean
}

const NAV_LINKS = [
  { href: '/journal', label: 'Dashboard', icon: Home },
  { href: '/entries', label: 'Entries', icon: BookOpen },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/conversations', label: 'Chat', icon: MessageCircle },
  { href: '/new', label: 'New', icon: PenLine, primary: true as const },
]

/**
 * Header — modern horizontal app chrome.
 *
 * Sticky top bar with logo on the left, nav links in the middle, and
 * user/theme actions on the right. Nav links use muted foreground with
 * hover to foreground; terracotta is reserved for the primary CTA ("New")
 * and the currently-active route indicator.
 */
export function Header({ showNav = true }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuth()
  const openCommandPalette = useCommandPaletteStore((s) => s.setOpen)

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  const handleLogout = useCallback(async () => {
    await logout()
    router.push('/login')
  }, [logout, router])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href) ?? false
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Left: app name */}
        <Link
          href="/journal"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/80"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background">
            <span className="text-[10px] font-bold">EV</span>
          </span>
          <span>EchoVault</span>
        </Link>

        {/* Center: nav links — hidden on mobile */}
        {showNav && (
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.filter((l) => !l.primary).map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {showNav && user && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCommandPalette(true)}
                aria-label="Search entries"
                className="hidden h-8 gap-2 px-3 text-muted-foreground md:inline-flex"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">Search</span>
                <kbd className="pointer-events-none ml-1 hidden items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
                  {isMac ? '⌘' : 'Ctrl'}K
                </kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openCommandPalette(true)}
                aria-label="Search entries"
                className="md:hidden"
              >
                <Search className="h-4 w-4" />
              </Button>
            </>
          )}
          {showNav && (
            <>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/new">
                  <PenLine className="h-3.5 w-3.5" />
                  New entry
                </Link>
              </Button>
              <Button asChild size="icon" className="md:hidden">
                <Link href="/new" aria-label="New entry">
                  <PenLine className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Account menu"
                className="hidden md:inline-flex"
              >
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {user && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {user.username ?? user.email}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex w-full items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="flex w-full items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Help
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          {showNav && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {NAV_LINKS.map((link) => {
                  const Icon = link.icon
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          'flex w-full items-center gap-2',
                          isActive(link.href) &&
                            'text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex w-full items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/help" className="flex w-full items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Help
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}

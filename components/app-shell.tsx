"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "This week", icon: WeekIcon },
  { href: "/plans", label: "Plans", icon: PlansIcon },
  { href: "/groceries", label: "Add groceries", icon: BagIcon },
  { href: "/kitchen", label: "Kitchen", icon: KitchenIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col md:flex-row">
      <aside className="hidden md:flex md:w-56 md:flex-col md:gap-2 md:px-4 md:pt-8">
        <p className="px-3 font-display text-lg font-semibold tracking-tight">Meal Plan</p>
        <nav className="mt-6 flex flex-col gap-1">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors ${
                  active ? "bg-teal text-white" : "text-ink/80 hover:bg-white/70"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/40 bg-canvas/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold ${
                      active ? "text-teal" : "text-muted"
                    }`}
                  >
                    <tab.icon className="h-6 w-6" />
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function WeekIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlansIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v3h8V3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h12l-1 12H7L6 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function KitchenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h16M10 10v10" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

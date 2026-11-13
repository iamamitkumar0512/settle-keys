"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Team" },
  { href: "/pay", label: "Pay" },
  { href: "/supplier", label: "Supplier" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-3 px-4 md:gap-6 md:px-8">
          <Logo />
          <span className="pill tone-due">Testnet</span>
          <nav aria-label="Main" className="flex gap-1">
            {NAV.map(({ href, label }) => {
              const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex h-10 items-center rounded-lg px-3 font-medium whitespace-nowrap hover:text-ink ${
                    current ? "bg-raised text-ink" : "text-muted"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-6 px-4 py-6 md:px-8 lg:py-8">
        {children}
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line p-6 text-center text-[13px]/[18px] text-muted">
        <span>Settle Keys · NEAR testnet · every person gets a key with a limit</span>
      </footer>
    </>
  );
}

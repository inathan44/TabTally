"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { Menu, Receipt } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/groups", label: "Groups" },
    ...(process.env.NODE_ENV === "development"
      ? [{ href: "/sandbox", label: "Playground" }]
      : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                TabTally
              </span>
              {process.env.NODE_ENV === "development" && (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  DEV
                </Badge>
              )}
            </Link>

            <Separator orientation="vertical" className="hidden h-5 sm:block" />

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-0.5 sm:flex">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-[13px] font-medium",
                    {
                      "bg-accent text-foreground": isActive(item.href),
                      "text-muted-foreground hover:text-foreground": !isActive(item.href),
                    },
                  )}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: { avatarBox: "h-7 w-7" },
                  }}
                />
              </SignedIn>
            </div>

            {/* Mobile Menu */}
            <div className="flex items-center gap-2 sm:hidden">
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: { avatarBox: "h-7 w-7" },
                  }}
                />
              </SignedIn>
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[260px]">
                  <SheetHeader className="text-left">
                    <SheetTitle className="text-sm">Navigation</SheetTitle>
                    <SheetDescription className="text-xs">
                      Go to a section of the app.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-0.5">
                    {navItems.map((item) => (
                      <Button
                        key={item.href}
                        asChild
                        variant={isActive(item.href) ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-[13px]"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Link href={item.href}>{item.label}</Link>
                      </Button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

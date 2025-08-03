"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "~/components/ui/button";
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
    { href: "/sandbox", label: "Sandbox" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const NavLink = ({ href, label, mobile = false }: { href: string; label: string; mobile?: boolean }) => {
    if (mobile) {
      return (
        <Button
          asChild
          variant={isActive(href) ? "secondary" : "ghost"}
          className="justify-start w-full text-left"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <Link href={href} className="truncate">
            {label}
          </Link>
        </Button>
      );
    }

    return (
      <Link
        href={href}
        className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
          isActive(href)
            ? "border-blue-500 text-gray-900"
            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
        <div className="flex h-16 justify-between items-center">
          {/* Logo and desktop nav */}
          <div className="flex items-center min-w-0">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold text-gray-900 truncate">
                TabTally
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </div>

          {/* Right side - Desktop user menu and mobile hamburger */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Desktop User Menu */}
            <div className="hidden sm:flex sm:items-center">
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>

            {/* Mobile Menu */}
            <div className="flex items-center sm:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="px-2 hover:bg-gray-100"
                    aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{isMobileMenuOpen ? "Close menu" : "Open menu"}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[400px]">
                  <SheetHeader className="text-left">
                    <SheetTitle>TabTally</SheetTitle>
                    <SheetDescription>
                      Navigate to different sections of the app
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="mt-8 flex flex-col space-y-2">
                    {navItems.map((item) => (
                      <NavLink key={item.href} href={item.href} label={item.label} mobile />
                    ))}
                  </div>

                  {/* Mobile User Menu */}
                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <SignedIn>
                      <div className="flex items-center space-x-3 rounded-md bg-gray-50 p-3">
                        <UserButton afterSignOutUrl="/" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">Account</span>
                          <span className="text-xs text-gray-500 truncate">Manage your profile</span>
                        </div>
                      </div>
                    </SignedIn>
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Mobile User Button - visible on mobile */}
              <div className="flex-shrink-0">
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

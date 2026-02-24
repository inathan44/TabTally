import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import Navbar from "~/components/Navbar";

import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { Receipt } from "lucide-react";

export const metadata: Metadata = {
  title: "TabTally",
  description: "Track and split expenses with friends, family, and groups.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable}`}>
        <body className="font-sans antialiased">
          <TRPCReactProvider>
            <div className="min-h-screen bg-background text-foreground">
              <SignedOut>
                <div className="flex min-h-screen items-center justify-center px-4">
                  <div className="w-full max-w-sm space-y-10 text-center">
                    <div className="space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                        <Receipt className="h-7 w-7 text-primary" />
                      </div>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        TabTally
                      </h1>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Track shared expenses and settle up with friends.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <SignInButton mode="modal">
                        <Button size="lg" className="w-full text-sm font-medium">
                          Sign In
                        </Button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <Button variant="outline" size="lg" className="w-full text-sm font-medium">
                          Create Account
                        </Button>
                      </SignUpButton>
                    </div>
                  </div>
                </div>
              </SignedOut>
              <SignedIn>
                <Navbar />
                <main>{children}</main>
              </SignedIn>
            </div>
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

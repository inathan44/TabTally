import Link from "next/link";
import { Users, ArrowRight, Receipt, TrendingUp } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what you can do with TabTally.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Link href="/groups" className="group">
          <Card className="h-full transition-all duration-200 hover:border-primary/30 hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Groups</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Create groups and invite friends to start splitting expenses.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                View groups
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/groups" className="group">
          <Card className="h-full transition-all duration-200 hover:border-success/30 hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/8">
                <Receipt className="h-5 w-5 text-success" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Expenses</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Log expenses and split them evenly or by custom amounts.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                Add expense
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full">
          <CardContent className="p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/8">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">Balances</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              See who owes what and settle up with simplified payments.
            </p>
            <div className="mt-4 text-xs font-medium text-muted-foreground">
              Available per group
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

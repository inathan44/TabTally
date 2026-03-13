"use client";

import { Crown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { formatDollars } from "~/lib/money";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface GroupCardProps {
  id: string;
  name: string;
  slug: string;
  balance: number;
  balanceType: "receive" | "pay";
  imageUrl?: string;
  isOwner?: boolean;
  className?: string;
}

export function GroupCard({
  name,
  slug,
  balance,
  balanceType,
  imageUrl,
  isOwner = false,
  className = "",
}: GroupCardProps) {
  const utils = api.useUtils();

  const handleMouseEnter = () => {
    void utils.group.getGroupBySlug.prefetch({ slug });
  };

  const formatBalance = (amount: number) => formatDollars(Math.abs(amount));

  const getBalanceText = () => {
    if (balance === 0) return "Settled up";
    return balanceType === "receive"
      ? `You are owed ${formatBalance(balance)}`
      : `You owe ${formatBalance(balance)}`;
  };

  const getBalanceColor = () => {
    if (balance === 0) return "text-muted-foreground";
    return balanceType === "receive" ? "text-success" : "text-destructive";
  };

  return (
    <Link
      href={`/groups/${slug}`}
      className={cn(
        "group border-border bg-card hover:bg-muted/40 flex items-center justify-between rounded-xl border px-4 py-3.5 transition-all duration-150 hover:shadow-sm",
        className,
      )}
      onMouseEnter={handleMouseEnter}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-9 w-9 rounded-lg">
            {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
            <AvatarFallback className="bg-primary/8 text-primary rounded-lg text-xs font-semibold">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOwner && (
            <div className="bg-warning absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full">
              <Crown className="text-warning-foreground h-2.5 w-2.5" />
            </div>
          )}
        </div>
        <div>
          <p className="text-foreground text-sm font-medium">{name}</p>
          <p className={cn("text-xs", getBalanceColor())}>{getBalanceText()}</p>
        </div>
      </div>
      <ChevronRight className="text-muted-foreground/50 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

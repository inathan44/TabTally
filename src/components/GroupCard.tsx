"use client";

import { Crown, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { Card, CardTitle, CardDescription, CardContent } from "./ui/card";

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

export function GroupCard({ name, slug, balance, balanceType, imageUrl, isOwner = false, className = "" }: GroupCardProps) {
  const utils = api.useUtils();

  const handleMouseEnter = () => {
    void utils.group.getGroupBySlug.prefetch({
      slug: slug,
    });
  };

  const formatBalance = (amount: number) => {
    return `$${Math.abs(amount).toFixed(0)}`;
  };

  const getBalanceText = () => {
    if (balanceType === "receive") {
      return `To Receive: ${formatBalance(balance)}`;
    }
    return `To Pay: ${formatBalance(balance)}`;
  };

  const getBalanceColor = () => {
    return balanceType === "receive" ? "text-green-600" : "text-red-600";
  };

  return (
    <Card className={`relative gap-0 border-gray-200 py-0 transition-all duration-200 hover:shadow-md ${className}`} onMouseEnter={handleMouseEnter}>
      <CardContent className="p-0">
        <Link href={`/groups/${slug}`} className="flex items-center justify-between p-4 pr-16 md:p-6 md:pr-20">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Group Avatar */}
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-red-400 via-orange-400 to-yellow-400 md:h-14 md:w-14">{imageUrl ? <Image src={imageUrl} alt={name} width={56} height={56} className="h-full w-full object-cover" /> : <span className="text-lg font-semibold text-white md:text-xl">{name.charAt(0).toUpperCase()}</span>}</div>
              {/* Admin Crown */}
              {isOwner && (
                <div className="absolute -top-1 -right-1 rounded-full bg-yellow-400 p-1">
                  <Crown className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Group Info */}
            <div className="flex flex-col">
              <CardTitle className="text-base font-semibold text-gray-900 md:text-lg">{name}</CardTitle>
              <CardDescription className={`text-sm font-medium md:text-base ${getBalanceColor()}`}>{getBalanceText()}</CardDescription>
            </div>
          </div>
        </Link>
      </CardContent>

      {/* Button positioned absolutely on the Card itself */}
      <Button
        className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full p-2 transition-colors hover:bg-gray-100 md:right-6"
        variant={"ghost"}
        size={"icon"}
        onClick={(e) => {
          e.preventDefault(); // Prevent Link navigation
          // Add your menu logic here
        }}
      >
        <MoreHorizontal className="h-5 w-5 text-gray-500" />
      </Button>
    </Card>
  );
}

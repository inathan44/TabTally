import { Edit } from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";

interface UserProfileProps {
  name: string;
  phone?: string;
  avatarUrl?: string;
  className?: string;
}

export function UserProfile({ name, phone, avatarUrl, className = "" }: UserProfileProps) {
  return (
    <div className={cn("flex flex-col items-center space-y-4 py-8 text-center md:space-y-6 md:py-12", className)}>
      {/* User Avatar */}
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-red-400 via-orange-400 to-yellow-400 md:h-32 md:w-32">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={name} width={128} height={128} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-bold text-white md:text-4xl">
            {name
              .split(" ")
              .map((n) => n.charAt(0))
              .join("")
              .toUpperCase()}
          </span>
        )}
      </div>

      {/* User Info */}
      <div className="space-y-1 md:space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{name}</h1>
        {phone && <p className="text-gray-600 md:text-lg">{phone}</p>}
      </div>

      {/* Edit Profile Button */}
      <Button>
        <Edit className="h-4 w-4 md:h-5 md:w-5" />
        Edit Profile
      </Button>
    </div>
  );
}

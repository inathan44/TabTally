"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useDebounce } from "~/hooks/use-debounce";

export interface SearchedUser {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
}

export interface InvitedUser {
  user: SearchedUser;
  role: "user" | "admin";
}

interface InviteUserPickerProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  fieldName: Path<T>;
  canAssignRoles?: boolean;
  isDisabled?: (user: SearchedUser) => boolean;
  disabledLabel?: (user: SearchedUser) => string;
  placeholder?: string;
}

export default function InviteUserPicker<T extends FieldValues>({
  form,
  fieldName,
  canAssignRoles = false,
  isDisabled,
  disabledLabel,
  placeholder = "Search by username or email",
}: InviteUserPickerProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery);
  const [showResults, setShowResults] = useState(false);

  const invitedUsers = (form.watch(fieldName) ?? []) as InvitedUser[];

  const getValues = () => (form.getValues(fieldName) ?? []) as InvitedUser[];
  const setValues = (users: InvitedUser[]) => form.setValue(fieldName, users as T[Path<T>]);

  const handleAdd = (user: SearchedUser) => {
    setValues([...getValues(), { user, role: "user" }]);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleRemove = (userId: string) => {
    setValues(getValues().filter((u) => u.user.id !== userId));
  };

  const handleRoleChange = (userId: string, role: "user" | "admin") => {
    setValues(getValues().map((u) => (u.user.id === userId ? { ...u, role } : u)));
  };

  const {
    data: searchResults,
    refetch: searchUsers,
    isLoading: isSearching,
  } = api.user.searchUsers.useQuery({ query: debouncedQuery }, { enabled: false, retry: false });

  useEffect(() => {
    if (debouncedQuery.trim()) {
      setShowResults(true);
      void searchUsers();
    } else {
      setShowResults(false);
    }
  }, [debouncedQuery, searchUsers]);

  const users = searchResults?.data ?? [];

  const isUserDisabled = (user: SearchedUser) => {
    if (invitedUsers.some((u) => u.user.id === user.id)) return true;
    return isDisabled?.(user) ?? false;
  };

  const getUserDisabledLabel = (user: SearchedUser) => {
    if (invitedUsers.some((u) => u.user.id === user.id)) return "Already added";
    if (isDisabled?.(user) && disabledLabel) return disabledLabel(user);
    return undefined;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(false);
          }}
          className="pl-10"
        />
      </div>

      {isSearching && <p className="text-muted-foreground text-sm">Searching...</p>}

      {showResults && users.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {users.map((user) => {
            const disabled = isUserDisabled(user);
            const label = getUserDisabledLabel(user);
            return (
              <Button
                key={user.id}
                type="button"
                variant="ghost"
                className={cn("h-auto w-full justify-start rounded-none p-3", {
                  "cursor-not-allowed opacity-50": disabled,
                  "hover:bg-muted": !disabled,
                })}
                disabled={disabled}
                onClick={() => !disabled && handleAdd(user)}
              >
                <div className="flex w-full flex-col items-start">
                  <div className="font-medium">
                    {user.firstName} {user.lastName}
                    {disabled && label && (
                      <span className="text-muted-foreground ml-2 text-xs">({label})</span>
                    )}
                  </div>
                  {user.username && (
                    <div className="text-muted-foreground text-sm">@{user.username}</div>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      )}

      {showResults && users.length === 0 && !isSearching && debouncedQuery.trim() && (
        <p className="text-muted-foreground text-xs">No users found</p>
      )}

      {searchResults?.error && showResults && (
        <p className="text-destructive text-xs">Error: {searchResults.error.message}</p>
      )}

      {invitedUsers.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {invitedUsers.map((invitedUser) => (
            <div
              key={invitedUser.user.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/8 text-primary text-xs font-medium">
                    {invitedUser.user.firstName.charAt(0)}
                    {invitedUser.user.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {invitedUser.user.firstName} {invitedUser.user.lastName}
                  </p>
                  {invitedUser.user.username && (
                    <p className="text-muted-foreground text-xs">@{invitedUser.user.username}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canAssignRoles && (
                  <Select
                    value={invitedUser.role}
                    onValueChange={(value: "user" | "admin") =>
                      handleRoleChange(invitedUser.user.id, value)
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue>{invitedUser.role === "admin" ? "Admin" : "User"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex flex-col">
                          <span>User</span>
                          <span className="text-muted-foreground text-xs">
                            Can view and participate
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex flex-col">
                          <span>Admin</span>
                          <span className="text-muted-foreground text-xs">Can manage members</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                  onClick={() => handleRemove(invitedUser.user.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

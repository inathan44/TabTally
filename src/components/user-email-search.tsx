"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export interface SearchedUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
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
  placeholder = "Search users by email",
}: InviteUserPickerProps<T>) {
  const [searchEmail, setSearchEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [showResults, setShowResults] = useState(false);

  const invitedUsers = (form.watch(fieldName) ?? []) as InvitedUser[];

  const getValues = () => (form.getValues(fieldName) ?? []) as InvitedUser[];
  const setValues = (users: InvitedUser[]) => form.setValue(fieldName, users as T[Path<T>]);

  const handleAdd = (user: SearchedUser) => {
    setValues([...getValues(), { user: { ...user, email: debouncedEmail }, role: "user" }]);
    setSearchEmail("");
    setDebouncedEmail("");
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
    refetch: searchUserByEmail,
    isLoading: isSearching,
  } = api.user.searchUserByEmail.useQuery(
    { email: debouncedEmail },
    { enabled: false, retry: false },
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(searchEmail);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchEmail]);

  useEffect(() => {
    if (debouncedEmail.trim()) {
      setShowResults(true);
      void searchUserByEmail();
    } else {
      setShowResults(false);
    }
  }, [debouncedEmail, searchUserByEmail]);

  const searchedUser = searchResults?.data;
  const isAlreadyInvited = searchedUser
    ? invitedUsers.some((u) => u.user.id === searchedUser.id)
    : false;
  /**
   * Determines whether the component should be disabled based on the searched user.
   *
   * - If a `searchedUser` exists, it calls the optional `isDisabled` function with `searchedUser` as an argument.
   *   - If `isDisabled` is not provided, defaults to `false`.
   * - If no `searchedUser` exists, defaults to `false`.
   *
   * @remarks
   * This allows conditional disabling of the component depending on the user being searched and custom logic provided via `isDisabled`.
   *
   * @example
   * ```tsx
   * const isExternallyDisabled = searchedUser ? isDisabled?.(searchedUser) ?? false : false;
   * ```
   */
  const isExternallyDisabled = searchedUser ? isDisabled?.(searchedUser) ?? false : false;
  const disabled = isAlreadyInvited || isExternallyDisabled;

  const getDisabledLabel = (user: SearchedUser) => {
    if (isAlreadyInvited) return "Already added";
    if (isExternallyDisabled && disabledLabel) return disabledLabel(user);
    return undefined;
  };

  const handleSelect = (user: SearchedUser) => {
    if (disabled) return;
    handleAdd(user);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchEmail}
          onChange={(e) => {
            setSearchEmail(e.target.value);
            setShowResults(false);
          }}
          className="pl-10"
        />
      </div>

      {isSearching && (
        <p className="text-sm text-muted-foreground">Searching...</p>
      )}

      {searchedUser && showResults && (
        <div className="max-h-32 overflow-y-auto rounded-md border">
          <Button
            type="button"
            variant="ghost"
            className={cn("h-auto w-full justify-start rounded-none p-3", {
              "cursor-not-allowed opacity-50": disabled,
              "hover:bg-muted": !disabled,
            })}
            disabled={disabled}
            onClick={() => handleSelect(searchedUser)}
          >
            <div className="flex w-full flex-col items-start">
              <div className="font-medium">
                {searchedUser.firstName} {searchedUser.lastName}
                {disabled && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({getDisabledLabel(searchedUser)})
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{debouncedEmail}</div>
            </div>
          </Button>
        </div>
      )}

      {searchResults?.error?.code === "NOT_FOUND" && showResults && (
        <p className="text-xs text-muted-foreground">No user found with that email</p>
      )}

      {searchResults?.error &&
        searchResults.error.code !== "NOT_FOUND" &&
        showResults && (
          <p className="text-xs text-destructive">Error: {searchResults.error.message}</p>
        )}

      {invitedUsers.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {invitedUsers.map((invitedUser) => (
            <div key={invitedUser.user.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/8 text-xs font-medium text-primary">
                    {invitedUser.user.firstName.charAt(0)}
                    {invitedUser.user.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {invitedUser.user.firstName} {invitedUser.user.lastName}
                  </p>
                  {invitedUser.user.email && (
                    <p className="text-xs text-muted-foreground">{invitedUser.user.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canAssignRoles && (
                  <Select
                    value={invitedUser.role}
                    onValueChange={(value: "user" | "admin") => handleRoleChange(invitedUser.user.id, value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue>{invitedUser.role === "admin" ? "Admin" : "User"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex flex-col">
                          <span>User</span>
                          <span className="text-muted-foreground text-xs">Can view and participate</span>
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
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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

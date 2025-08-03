"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { X, Search, Users, Plus } from "lucide-react";
import { createGroupFormSchema, type CreateGroupForm } from "~/server/contracts/groups";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import { AnimatedButton } from "./ui/animated-button";

export default function CreateGroupModal() {
  const utils = api.useUtils();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [debouncedSearchEmail, setDebouncedSearchEmail] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [searchResultsError, setSearchResultsError] = useState<string | null>(null);
  const [isGroupCreationSuccessful, setIsGroupCreationSuccessful] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const form = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupFormSchema),
    defaultValues: {
      name: "",
      invitedUsers: [],
    },
  });

  const { data: searchResults, refetch: searchUserByEmail, isLoading: isSearching } = api.user.searchUserByEmail.useQuery({ email: debouncedSearchEmail }, { enabled: false, retry: false });

  const createGroupMutation = api.group.createGroup.useMutation();

  const invitedUsers = form.watch("invitedUsers");

  const isUserAlreadyInvited = searchResults?.data ? invitedUsers?.some((invitedUser) => invitedUser.user.id === searchResults.data.id) : false;

  useEffect(() => {
    const delayInMilliseconds = 300;

    const timer = setTimeout(() => {
      setDebouncedSearchEmail(searchEmail);
    }, delayInMilliseconds);

    return () => clearTimeout(timer);
  }, [searchEmail]);

  useEffect(() => {
    if (debouncedSearchEmail.trim()) {
      setShowSearchResults(true);
      setSearchResultsError(null);
      void searchUserByEmail().catch((error) => {
        setSearchResultsError("Failed to search users. Please try again.");
        console.error("Search error:", error);
      });
    } else {
      setShowSearchResults(false);
      setSearchResultsError(null);
    }
  }, [debouncedSearchEmail, searchUserByEmail]);

  const handleSearchChange = (value: string) => {
    setSearchEmail(value);
    setShowSearchResults(false);
    setSearchResultsError(null);
  };

  const addUser = (searchedUser: { id: string; firstName?: string; lastName?: string; email?: string }) => {
    if (isUserAlreadyInvited) return;

    const newInvitedUser = {
      user: {
        id: searchedUser.id,
        firstName: searchedUser.firstName,
        lastName: searchedUser.lastName,
        email: searchedUser.email,
      },
      role: "user" as const,
    };
    const currentUsers = form.getValues("invitedUsers");
    form.setValue("invitedUsers", [...(currentUsers ?? []), newInvitedUser]);
    setSearchEmail("");
    setDebouncedSearchEmail("");
  };

  const removeUser = (userId: string) => {
    const currentUsers = form.getValues("invitedUsers") ?? [];
    form.setValue(
      "invitedUsers",
      currentUsers.filter((invitedUser) => invitedUser.user.id !== userId),
    );
  };

  const updateUserRole = (userId: string, role: "user" | "admin") => {
    const currentUsers = form.getValues("invitedUsers") ?? [];
    form.setValue(
      "invitedUsers",
      currentUsers.map((invitedUser) => (invitedUser.user.id === userId ? { ...invitedUser, role } : invitedUser)),
    );
  };

  const onSubmit = async (groupFormData: CreateGroupForm) => {
    const apiData = {
      name: groupFormData.name,
      description: groupFormData.description,
      invitedUsers:
        groupFormData.invitedUsers?.map((invitedUser) => ({
          userId: invitedUser.user.id,
          role: invitedUser.role,
        })) ?? [],
    };

    const { data: createGroupResponse, error: createGroupError } = await createGroupMutation.mutateAsync(apiData);
    if (createGroupMutation.error) {
      setCreateGroupError("Error creating group, please try again later.");
      return;
    }

    if (createGroupError) {
      setCreateGroupError(createGroupError.message);
      return;
    }

    console.log("Group created successfully:", createGroupResponse);

    setIsGroupCreationSuccessful(true);

    setTimeout(() => {
      setIsGroupCreationSuccessful(false);
      setIsRedirecting(true);

      form.reset();
      setSearchEmail("");
      setDebouncedSearchEmail("");
      setCreateGroupError(null);

      void utils.user.getGroups.invalidate();
      router.push(`/groups/${createGroupResponse}?new=true`);
    }, 1000);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      setSearchEmail("");
      setIsGroupCreationSuccessful(false);
      setIsRedirecting(false);
      setSearchResultsError(null);
    }
    setCreateGroupError(null);
  };

  const searchedUser = searchResults?.data;

  return (
    <Dialog open={open} onOpenChange={isRedirecting ? undefined : handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[600px]">
        {isRedirecting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              <span>Redirecting to your new group...</span>
            </div>
          </div>
        )}
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Group
          </DialogTitle>
          <DialogDescription>Create a new group and invite users to collaborate.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto px-1 py-4">
              {createGroupError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="text-sm break-words text-red-600">
                    <strong>Error creating group:</strong> {createGroupError}
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter group name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter group description (optional)" className="min-h-[80px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Invite Users</FormLabel>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                  <Input placeholder="Search users by email" value={searchEmail} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10" />
                </div>

                {searchedUser && showSearchResults && (
                  <div className="max-h-32 overflow-y-auto rounded-md border">
                    <Button
                      variant="ghost"
                      className={cn("h-auto w-full justify-start rounded-none border-b p-3 last:border-b-0", {
                        "cursor-not-allowed opacity-50": isUserAlreadyInvited,
                        "hover:bg-muted": !isUserAlreadyInvited,
                      })}
                      disabled={isUserAlreadyInvited}
                      onClick={() => !isUserAlreadyInvited && addUser(searchedUser)}
                    >
                      <div className="flex w-full flex-col items-start">
                        <div className="font-medium">
                          {searchedUser.firstName} {searchedUser.lastName}
                          {isUserAlreadyInvited && <span className="text-muted-foreground ml-2 text-xs">(Already invited)</span>}
                        </div>
                        <div className="text-muted-foreground text-sm">{debouncedSearchEmail}</div>
                      </div>
                    </Button>
                  </div>
                )}

                {searchResultsError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <div className="text-sm text-red-600">
                      <strong>Search Error:</strong> {searchResultsError}
                    </div>
                  </div>
                )}

                {isSearching && <div className="text-muted-foreground text-sm">Searching...</div>}
                {searchResults?.error?.code === "NOT_FOUND" && showSearchResults && <div className="text-muted-foreground text-xs">No users found with that email</div>}
                {searchResults?.error && searchResults.error.code !== "NOT_FOUND" && !searchResultsError && <div className="text-xs text-red-600">Error: {searchResults.error.message}</div>}
              </div>

              {invitedUsers && invitedUsers.length > 0 && (
                <FormField
                  control={form.control}
                  name="invitedUsers"
                  render={() => (
                    <FormItem>
                      <FormLabel>Invited Users ({invitedUsers.length})</FormLabel>
                      <div className="max-h-40 space-y-2 overflow-y-auto">
                        {invitedUsers.map((invitedUser) => (
                          <div key={invitedUser.user.id} className="flex items-center justify-between rounded-md border p-3">
                            <div className="flex-1">
                              <div className="font-medium">
                                {invitedUser.user.firstName} {invitedUser.user.email}
                              </div>
                              <div className="text-muted-foreground text-sm">{invitedUser.user.email}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select value={invitedUser.role} onValueChange={(value: "user" | "admin") => updateUserRole(invitedUser.user.id, value)}>
                                <SelectTrigger className="w-24">
                                  <SelectValue>{invitedUser.role === "admin" ? "Admin" : "User"}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">
                                    <div className="flex flex-col">
                                      <span>User</span>
                                      <span className="text-muted-foreground text-xs">Can view and participate in group activities</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="admin">
                                    <div className="flex flex-col">
                                      <span>Admin</span>
                                      <span className="text-muted-foreground text-xs">Can manage group settings and members</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" onClick={() => removeUser(invitedUser.user.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter className="mt-4 shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <AnimatedButton type="submit" loading={form.formState.isSubmitting || isRedirecting} success={isGroupCreationSuccessful} loadingType="spinner" loadingText={isRedirecting ? "Redirecting..." : "Creating..."} successText="Group Created!" minWidth="120px" icon={<Plus className="h-4 w-4" />}>
                Create Group
              </AnimatedButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

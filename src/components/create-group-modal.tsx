"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Users, Plus } from "lucide-react";
import { createGroupFormSchema, type CreateGroupForm } from "~/server/contracts/groups";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { AnimatedButton } from "./ui/animated-button";
import InviteUserPicker from "./user-email-search";

export default function CreateGroupModal() {
  const utils = api.useUtils();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const form = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupFormSchema),
    defaultValues: {
      name: "",
      invitedUsers: [],
    },
  });

  const createGroupMutation = api.group.createGroup.useMutation();

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

    const result = await createGroupMutation.mutateAsync(apiData);

    if (result.error) return;

    setIsRedirecting(true);
    form.reset();
    createGroupMutation.reset();
    void utils.user.getGroups.invalidate();
    router.push(`/groups/${result.data}?new=true`);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      setIsRedirecting(false);
      createGroupMutation.reset();
    }
  };

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
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
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
              {(createGroupMutation.data?.error ?? createGroupMutation.error) && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <div className="text-sm break-words text-destructive">
                    <strong>Error creating group:</strong>{" "}
                    {createGroupMutation.data?.error?.message ?? createGroupMutation.error?.message ?? "An unexpected error occurred."}
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
                <InviteUserPicker
                  form={form}
                  fieldName="invitedUsers"
                  canAssignRoles
                />
              </div>
            </div>

            <DialogFooter className="mt-4 shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <AnimatedButton type="submit" loading={form.formState.isSubmitting || isRedirecting} success={createGroupMutation.isSuccess && !createGroupMutation.data?.error} loadingType="spinner" loadingText={isRedirecting ? "Redirecting..." : "Creating..."} successText="Group Created!" minWidth="120px" icon={<Plus className="h-4 w-4" />}>
                Create Group
              </AnimatedButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

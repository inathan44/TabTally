"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Form } from "~/components/ui/form";
import { api } from "~/trpc/react";
import { AnimatedButton } from "./ui/animated-button";
import InviteUserPicker from "./user-email-search";
import {
  inviteMembersFormSchema,
  type InviteMembersForm,
  type GroupMember,
} from "~/server/contracts/groups";

interface InviteMemberModalProps {
  groupId: number;
  existingMembers: GroupMember[];
  canAssignRoles?: boolean;
}

export default function InviteMemberModal({
  groupId,
  existingMembers,
  canAssignRoles = false,
}: InviteMemberModalProps) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);

  const form = useForm<InviteMembersForm>({
    resolver: zodResolver(inviteMembersFormSchema),
    defaultValues: { invitedUsers: [] },
  });

  const inviteMutation = api.group.inviteUser.useMutation();
  const invitedUsers = form.watch("invitedUsers");

  const onSubmit = async (data: InviteMembersForm) => {
    for (const invitedUser of data.invitedUsers) {
      const { error } = await inviteMutation.mutateAsync({
        groupId,
        inviteeUserId: invitedUser.user.id,
        role: invitedUser.role,
      });

      if (error) return;
    }

    setOpen(false);
    form.reset();
    inviteMutation.reset();
    void utils.group.getGroupBySlug.invalidate();
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      inviteMutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Members
          </DialogTitle>
          <DialogDescription>
            Search by username or email to invite people to this group.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {(inviteMutation.data?.error ?? inviteMutation.error) && (
              <div className="border-destructive/20 bg-destructive/5 rounded-md border p-3">
                <p className="text-destructive text-sm">
                  {inviteMutation.data?.error?.message ??
                    inviteMutation.error?.message ??
                    "An unexpected error occurred."}
                </p>
              </div>
            )}

            <InviteUserPicker
              form={form}
              fieldName="invitedUsers"
              canAssignRoles={canAssignRoles}
              isDisabled={(user) =>
                existingMembers.some((m) => m.id === user.id && m.status !== "LEFT")
              }
              disabledLabel={(user) => {
                const member = existingMembers.find((m) => m.id === user.id);
                return member?.status === "INVITED" ? "Already invited" : "Already a member";
              }}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <AnimatedButton
                type="submit"
                disabled={invitedUsers.length === 0}
                loading={inviteMutation.isPending}
                success={inviteMutation.isSuccess && !inviteMutation.data?.error}
                loadingType="spinner"
                loadingText="Inviting..."
                successText="Invited!"
                minWidth="100px"
                icon={<UserPlus className="h-4 w-4" />}
              >
                Invite {invitedUsers.length > 0 && `(${invitedUsers.length})`}
              </AnimatedButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

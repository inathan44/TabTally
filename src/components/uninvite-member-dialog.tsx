"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

interface UninviteMemberDialogProps {
  groupId: number;
  memberId: string;
  memberName: string;
}

export default function UninviteMemberDialog({
  groupId,
  memberId,
  memberName,
}: UninviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const uninviteMutation = api.group.uninviteUser.useMutation();

  const restoreInviteMutation = api.group.restoreInvite.useMutation();

  const handleRestore = () => {
    const promise = restoreInviteMutation
      .mutateAsync({ groupId, userId: memberId })
      .then((result) => {
        if (result.error) throw new Error(result.error.message);
        void utils.group.getGroupBySlug.invalidate();
        return `Invite restored for ${memberName}`;
      });

    void toast.promise(promise, {
      loading: "Restoring invite...",
      success: (msg) => msg,
      error: "Failed to restore invite. Please try again.",
    });
  };

  const handleUninvite = async () => {
    try {
      const result = await uninviteMutation.mutateAsync({ groupId, userId: memberId });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      void utils.group.getGroupBySlug.invalidate();
      setOpen(false);
      toast(`Invite revoked for ${memberName}`, {
        action: {
          label: "Undo",
          onClick: handleRestore,
        },
        duration: 6000,
      });
    } catch {
      toast.error("Failed to revoke invite. Please try again.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          title="Revoke invite"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke invite?</AlertDialogTitle>
          <AlertDialogDescription>
            This will revoke the invite for {memberName}. You can undo this
            action shortly after.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={uninviteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleUninvite}
            disabled={uninviteMutation.isPending}
          >
            {uninviteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {uninviteMutation.isPending ? "Revoking..." : "Revoke Invite"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
import type { GetGroupResponse } from "~/server/contracts/groups";

interface DangerZoneSettingsProps {
  group: GetGroupResponse;
  groupSlug: string;
}

export default function DangerZoneSettings({ group, groupSlug }: DangerZoneSettingsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = api.group.deleteGroup.useMutation();
  const restoreMutation = api.group.restoreGroup.useMutation();

  const handleRestore = () => {
    const promise = restoreMutation
      .mutateAsync({ groupId: group.id })
      .then((result) => {
        if (result.error) throw new Error(result.error.message);
        router.push(`/groups/${groupSlug}`);
        return `"${group.name}" restored`;
      });

    void toast.promise(promise, {
      loading: "Restoring group...",
      success: (msg) => msg,
      error: "Failed to restore group. Please try again.",
    });
  };

  const handleDelete = async () => {
    try {
      const result = await deleteMutation.mutateAsync({
        groupId: group.id,
      });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      setDeleteOpen(false);
      router.push("/groups");
      toast(`"${group.name}" deleted`, {
        action: {
          label: "Undo",
          onClick: handleRestore,
        },
        duration: 6000,
      });
    } catch {
      toast.error("Failed to delete group.");
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions. Please be certain before proceeding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
          <div>
            <p className="text-sm font-medium">Delete this group</p>
            <p className="text-xs text-muted-foreground">
              This will permanently delete the group and all its data.
            </p>
          </div>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Group
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &quot;{group.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All transactions, balances, and member data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {deleteMutation.isPending ? "Deleting..." : "Delete Group"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

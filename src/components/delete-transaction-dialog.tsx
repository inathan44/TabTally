"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
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

interface DeleteTransactionDialogProps {
  groupId: number;
  transactionId: number;
  transactionDescription: string;
}

export default function DeleteTransactionDialog({
  groupId,
  transactionId,
  transactionDescription,
}: DeleteTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const deleteMutation = api.group.deleteTransaction.useMutation();
  const restoreMutation = api.group.restoreTransaction.useMutation();

  const handleRestore = () => {
    const promise = restoreMutation
      .mutateAsync({ groupId, transactionId })
      .then((result) => {
        if (result.error) throw new Error(result.error.message);
        void utils.group.getGroupBySlug.invalidate();
        return `"${transactionDescription}" restored`;
      });

    void toast.promise(promise, {
      loading: "Restoring transaction...",
      success: (msg) => msg,
      error: "Failed to restore transaction. Please try again.",
    });
  };

  const handleDelete = async () => {
    try {
      const result = await deleteMutation.mutateAsync({ groupId, transactionId });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      void utils.group.getGroupBySlug.invalidate();
      setOpen(false);
      toast(`"${transactionDescription}" deleted`, {
        action: {
          label: "Undo",
          onClick: handleRestore,
        },
        duration: 6000,
      });
    } catch {
      toast.error("Failed to delete transaction. Please try again.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete &quot;{transactionDescription}&quot;. You can undo this action shortly after.
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
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ExternalLink } from "lucide-react";
import { api } from "~/trpc/react";
import { updatePaymentUsernamesSchema } from "~/server/contracts/users";

type PaymentUsernamesFormValues = z.infer<typeof updatePaymentUsernamesSchema>;

function getVenmoUrl(username: string): string | null {
  const cleaned = username.trim();
  return cleaned ? `https://venmo.com/u/${cleaned}` : null;
}

function getCashAppUrl(username: string): string | null {
  const cleaned = username.trim();
  return cleaned ? `https://cash.app/$${cleaned}` : null;
}

export default function PaymentUsernamesForm() {
  const { data: profileResult, isPending: profileLoading } = api.user.getProfile.useQuery();
  const utils = api.useUtils();
  const mutation = api.user.updatePaymentUsernames.useMutation();

  const profile = profileResult?.data;

  const form = useForm<PaymentUsernamesFormValues>({
    resolver: zodResolver(updatePaymentUsernamesSchema),
    values: {
      venmoUsername: profile?.venmoUsername ?? "",
      cashappUsername: profile?.cashappUsername ?? "",
    },
  });

  const watchedVenmo = form.watch("venmoUsername") ?? "";
  const watchedCashApp = form.watch("cashappUsername") ?? "";
  const venmoUrl = getVenmoUrl(watchedVenmo);
  const cashAppUrl = getCashAppUrl(watchedCashApp);

  const onSubmit = async (data: PaymentUsernamesFormValues) => {
    const result = await mutation.mutateAsync(data);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Payment usernames updated");
    void utils.user.getProfile.invalidate();
  };

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="bg-muted h-5 w-40 animate-pulse rounded" />
          <div className="bg-muted mt-1 h-4 w-60 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted h-10 animate-pulse rounded" />
          <div className="bg-muted h-10 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Usernames</CardTitle>
        <CardDescription>
          Add your payment handles so group members can easily pay you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="venmoUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venmo</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <span className="border-input bg-muted text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                        @
                      </span>
                      <Input
                        placeholder="username"
                        {...field}
                        value={field.value ?? ""}
                        className="rounded-l-none"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {venmoUrl ? (
                      <a
                        href={venmoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        {venmoUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "Your Venmo username"
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cashappUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cash App</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <span className="border-input bg-muted text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                        $
                      </span>
                      <Input
                        placeholder="username"
                        {...field}
                        value={field.value ?? ""}
                        className="rounded-l-none"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {cashAppUrl ? (
                      <a
                        href={cashAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        {cashAppUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "Your Cash App username"
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

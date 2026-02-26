"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import type { GetGroupResponse } from "~/server/contracts/groups";

const generalSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(255).optional(),
});

type GeneralSettingsForm = z.infer<typeof generalSettingsSchema>;

interface GeneralSettingsProps {
  group: GetGroupResponse;
}

export default function GeneralSettings({ group }: GeneralSettingsProps) {
  const utils = api.useUtils();
  const [saved, setSaved] = useState(false);

  const form = useForm<GeneralSettingsForm>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      name: group.name,
      description: group.description ?? "",
    },
  });

  const updateMutation = api.group.updateGroup.useMutation();

  const handleSubmit = async (values: GeneralSettingsForm) => {
    try {
      const result = await updateMutation.mutateAsync({
        groupId: group.id,
        name: values.name,
        description: values.description,
      });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      void utils.group.getGroupBySlug.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Group settings updated");
    } catch {
      toast.error("Failed to update group settings.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Update your group&apos;s name and description.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Group" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this group for?"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateMutation.isPending || !form.formState.isDirty}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {saved ? "Saved!" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

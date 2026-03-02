"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { AnimatedButton } from "~/components/ui/animated-button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useDebounce } from "~/hooks/use-debounce";
import { setupProfileSchema, USERNAME_MAX_LENGTH } from "~/server/contracts/users";
import type { SetupProfileInput } from "~/server/contracts/users";

export default function UsernameSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/groups";
  const { data: profileResult } = api.user.getProfile.useQuery();
  const profile = profileResult?.data;

  const form = useForm<SetupProfileInput>({
    resolver: zodResolver(setupProfileSchema),
    defaultValues: { username: "", venmoUsername: "", cashappUsername: "" },
    mode: "onChange",
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        username: form.getValues("username") ?? "",
        venmoUsername: profile.venmoUsername ?? "",
        cashappUsername: profile.cashappUsername ?? "",
      });
    }
  }, [profile, form]);

  const username = form.watch("username");
  const debouncedUsername = useDebounce(username, 400);
  const hasFieldError = !!form.formState.errors.username;
  const shouldCheck = !hasFieldError && username.length > 0;

  const {
    data: availabilityResult,
    isFetching: isChecking,
    refetch: checkAvailability,
  } = api.user.checkUsernameAvailability.useQuery(
    { username: debouncedUsername },
    { enabled: false, retry: false },
  );

  useEffect(() => {
    if (debouncedUsername && shouldCheck) {
      void checkAvailability();
    }
  }, [debouncedUsername, shouldCheck, checkAvailability]);

  const isAvailable =
    availabilityResult?.data?.available === true && debouncedUsername === username;

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: (result) => {
      if (result.error) {
        form.setError("username", { message: result.error.message });
        return;
      }
      router.push(redirectTo);
      router.refresh();
    },
  });

  const onSubmit = (data: SetupProfileInput) => {
    if (!isAvailable) return;

    const trimmedVenmo = data.venmoUsername?.trim();
    const trimmedCashApp = data.cashappUsername?.trim();

    updateProfileMutation.mutate({
      username: data.username,
      venmoUsername: trimmedVenmo === "" ? undefined : (trimmedVenmo ?? undefined),
      cashappUsername: trimmedCashApp === "" ? undefined : (trimmedCashApp ?? undefined),
    });
  };

  const getStatusIcon = () => {
    if (!username || hasFieldError) return null;
    if (isChecking || debouncedUsername !== username) {
      return <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />;
    }
    if (isAvailable) return <Check className="text-success h-4 w-4" />;
    if (availabilityResult?.data?.available === false)
      return <X className="text-destructive h-4 w-4" />;
    return null;
  };

  const getAvailabilityText = () => {
    if (!username || hasFieldError) return null;
    if (isChecking || debouncedUsername !== username) return "Checking availability...";
    if (isAvailable) return "Username is available!";
    if (availabilityResult?.error?.message === "That username is not allowed.")
      return "That username is not allowed.";
    if (availabilityResult?.data?.available === false) return "Username is taken";
    if (availabilityResult?.error) return "Error checking availability";
    return null;
  };

  const availabilityText = getAvailabilityText();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    @
                  </span>
                  <Input
                    placeholder="username"
                    {...field}
                    className="pr-10 pl-7"
                    autoFocus
                    autoComplete="off"
                    maxLength={USERNAME_MAX_LENGTH}
                  />
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">{getStatusIcon()}</div>
                </div>
              </FormControl>
              <FormMessage />
              {availabilityText && !form.formState.errors.username && (
                <p
                  className={cn("text-xs", {
                    "text-success": isAvailable,
                    "text-destructive": availabilityResult?.data?.available === false,
                    "text-muted-foreground":
                      !isAvailable && availabilityResult?.data?.available !== false,
                  })}
                >
                  {availabilityText}
                </p>
              )}
            </FormItem>
          )}
        />

        <div className="border-border space-y-4 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">Payment usernames</p>
            <p className="text-muted-foreground text-xs">
              Optional — makes it easier for friends to pay you.
            </p>
          </div>

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
                      placeholder="venmo-username"
                      {...field}
                      value={field.value ?? ""}
                      className="rounded-l-none"
                    />
                  </div>
                </FormControl>
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
                      placeholder="cashapp-username"
                      {...field}
                      value={field.value ?? ""}
                      className="rounded-l-none"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <AnimatedButton
          type="submit"
          className="w-full"
          disabled={!isAvailable}
          loading={updateProfileMutation.isPending}
          success={updateProfileMutation.isSuccess && !updateProfileMutation.data?.error}
          loadingType="spinner"
          loadingText="Setting up account..."
          successText="Done!"
        >
          Continue
        </AnimatedButton>
      </form>
    </Form>
  );
}

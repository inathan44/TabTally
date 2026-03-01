import { api, HydrateClient } from "~/trpc/server";
import PaymentUsernamesForm from "~/components/payment-usernames-form";
import UsernameDisplay from "~/components/username-display";

export default async function ProfilePage() {
  await api.user.getProfile.prefetch();

  return (
    <HydrateClient>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="space-y-1">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm">Manage your account settings.</p>
        </div>
        <div className="mt-8 space-y-6">
          <UsernameDisplay />
          <PaymentUsernamesForm />
        </div>
      </div>
    </HydrateClient>
  );
}

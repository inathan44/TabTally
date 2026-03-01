import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import UsernameSetupForm from "~/components/username-setup-form";

export default async function SetupPage() {
  const result = await api.user.getProfile();
  if (result.data?.username) {
    redirect("/groups");
  }
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Choose a username
          </h1>
          <p className="text-muted-foreground text-sm">
            Pick a unique username so your friends can find and invite you to groups.
          </p>
        </div>
        <UsernameSetupForm />
      </div>
    </div>
  );
}

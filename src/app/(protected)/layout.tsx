import { redirect } from "next/navigation";
import { api } from "~/trpc/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const result = await api.user.getProfile();

  if (!result.data?.username) redirect("/setup");

  return <>{children}</>;
}

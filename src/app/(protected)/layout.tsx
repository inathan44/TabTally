import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const result = await api.user.getProfile();

  if (!result.data?.username) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const redirectParam =
      pathname && pathname !== "/setup" ? `?redirect=${encodeURIComponent(pathname)}` : "";
    redirect(`/setup${redirectParam}`);
  }

  return <>{children}</>;
}

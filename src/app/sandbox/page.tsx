import { auth } from "@clerk/nextjs/server";
import { api } from "~/trpc/server";

export default async function Sandbox() {
  const { userId } = await auth();
  const user = await api.user.getUserById(userId ?? "");

  console.log("User:", user);

  return (
    <div>
      <p></p>
    </div>
  );
}

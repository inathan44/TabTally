import { auth } from "@clerk/nextjs/server";
import { api } from "~/trpc/server";
import { TestGroupCreation } from "./TestGroupCreation";
import { TestTransactionCreation } from "./TestTransactionCreation";
import AnimatedButtonExample from "~/components/AnimatedButtonExample";
import ReceiptParserPlayground from "./ReceiptParserPlayground";

export default async function Sandbox() {
  const { userId } = await auth();
  const user = await api.user.getUserById(userId ?? "");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">Sandbox - Test Area</h1>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">User Info</h2>
        <div className="rounded bg-gray-100 p-4">
          <p>
            <strong>User ID:</strong> {userId}
          </p>
          <p>
            <strong>User Data:</strong> {JSON.stringify(user, null, 2)}
          </p>
        </div>
      </div>

      <TestGroupCreation />

      <TestTransactionCreation />

      <div className="border-t pt-8">
        <ReceiptParserPlayground />
      </div>

      <div className="border-t pt-8">
        <AnimatedButtonExample />
      </div>
    </div>
  );
}

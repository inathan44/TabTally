"use client";

import { api } from "~/trpc/react";

export function TestGroupCreation() {
  const { isPending, data: response, mutate } = api.group.createGroup.useMutation({});

  if (response?.error) {
    return <div className="text-red-500">Error: {response.error.message}</div>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold">Test Group Creation</h3>

      <div className="space-y-2">
        <button
          onClick={() =>
            mutate({
              name: `Test Group ${Date.now()}`,
              description: "This is a test group created for sandbox purposes.",
            })
          }
          disabled={isPending}
          className={`rounded px-4 py-2 font-medium ${
            isPending
              ? "cursor-not-allowed bg-gray-300 text-gray-500"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {isPending ? "Creating Group..." : "Create Test Group (No Invites)"}
        </button>

        <button
          onClick={() =>
            mutate({
              name: `Test Group with Invites ${Date.now()}`,
              description: "This is a test group with invited users.",
              invitedUsers: [
                {
                  userId: "mockUser", // Example user ID - replace with actual
                  role: "user" as const,
                },
              ],
            })
          }
          disabled={isPending}
          className={`rounded px-4 py-2 font-medium ${
            isPending
              ? "cursor-not-allowed bg-gray-300 text-gray-500"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {isPending ? "Creating Group..." : "Create Test Group (With Invites)"}
        </button>
      </div>

      {response?.data && (
        <div className="rounded border border-green-400 bg-green-100 p-3 text-green-700">
          Group created successfully! Slug: <strong>{response.data}</strong>
          <br />
          <small>Check the database for invited users if you used the invite button.</small>
        </div>
      )}
    </div>
  );
}

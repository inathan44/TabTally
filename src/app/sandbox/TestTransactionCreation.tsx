"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import type { GetUserGroupsResponse } from "~/server/contracts/users";

export function TestTransactionCreation() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Get current user from Clerk
  const { user } = useUser();

  // Get user's groups
  const { data: groupsResponse } = api.user.getGroups.useQuery();

  // Create transaction mutation
  const {
    isPending: isCreatingTransaction,
    data: transactionResponse,
    mutate: createTransaction,
    reset: resetTransaction,
  } = api.group.createTransaction.useMutation({});

  const handleCreateMockTransaction = () => {
    if (!selectedGroupId || !user?.id) {
      console.error("No group selected or user not found");
      return;
    }

    // Create a mock transaction with the current user as both payer and recipient
    const mockTransaction = {
      groupId: selectedGroupId,
      amount: 25.5,
      payerId: user.id,
      description: "Mock lunch expense - testing transaction creation",
      transactionDetails: [
        {
          recipientId: user.id,
          amount: 25.5,
        },
      ],
    };

    createTransaction(mockTransaction);
  };

  const handleCreateSplitTransaction = () => {
    if (!selectedGroupId || !user?.id || !groupsResponse?.data) {
      console.error("No group selected, user not found, or groups not loaded");
      return;
    }

    const selectedGroup = groupsResponse.data.find(
      (g: GetUserGroupsResponse) => g.id === selectedGroupId,
    );
    if (!selectedGroup || selectedGroup.groupUsers.length < 2) {
      console.error("Selected group not found or has insufficient members for split");
      return;
    }

    // Create a split transaction between multiple group members
    const totalAmount = 60.0; // $60.00
    const splitAmount = totalAmount / selectedGroup.groupUsers.length;

    const mockSplitTransaction = {
      groupId: selectedGroupId,
      amount: totalAmount,
      payerId: user.id,
      description: "Mock dinner expense - split between group members",
      transactionDetails: selectedGroup.groupUsers.map((groupUser) => ({
        recipientId: groupUser.id,
        amount: splitAmount,
      })),
    };

    createTransaction(mockSplitTransaction);
  };

  const availableGroups = groupsResponse?.data ?? [];

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold">Test Transaction Creation</h3>

      {/* Group Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Select Group for Transaction:
        </label>
        <select
          value={selectedGroupId ?? ""}
          onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">-- Select a group --</option>
          {availableGroups.map((group: GetUserGroupsResponse) => (
            <option key={group.id} value={group.id}>
              {group.name} ({group.groupUsers.length} members)
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCreateMockTransaction}
          disabled={isCreatingTransaction || !selectedGroupId}
          className={`rounded px-4 py-2 font-medium ${
            isCreatingTransaction || !selectedGroupId
              ? "cursor-not-allowed bg-gray-300 text-gray-500"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {isCreatingTransaction ? "Creating..." : "Create Single Transaction"}
        </button>

        <button
          onClick={handleCreateSplitTransaction}
          disabled={
            isCreatingTransaction ||
            !selectedGroupId ||
            (availableGroups.find((g: GetUserGroupsResponse) => g.id === selectedGroupId)
              ?.groupUsers.length ?? 0) < 2
          }
          className={`rounded px-4 py-2 font-medium ${
            isCreatingTransaction ||
            !selectedGroupId ||
            (availableGroups.find((g: GetUserGroupsResponse) => g.id === selectedGroupId)
              ?.groupUsers.length ?? 0) < 2
              ? "cursor-not-allowed bg-gray-300 text-gray-500"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {isCreatingTransaction ? "Creating..." : "Create Split Transaction"}
        </button>

        {transactionResponse && (
          <button
            onClick={resetTransaction}
            className="rounded bg-gray-500 px-4 py-2 font-medium text-white hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      {/* Results Display */}
      {transactionResponse?.error && (
        <div className="rounded border border-red-400 bg-red-100 p-3 text-red-700">
          <strong>Error:</strong> {transactionResponse.error.message}
        </div>
      )}

      {transactionResponse?.data && (
        <div className="rounded border border-green-400 bg-green-100 p-3 text-green-700">
          <strong>Success:</strong> {transactionResponse.data}
        </div>
      )}

      {/* Debug Info */}
      {selectedGroupId && (
        <div className="rounded bg-gray-50 p-3 text-sm text-gray-600">
          <strong>Selected Group:</strong>{" "}
          {availableGroups.find((g: GetUserGroupsResponse) => g.id === selectedGroupId)?.name}{" "}
          <br />
          <strong>Members:</strong>{" "}
          {
            availableGroups.find((g: GetUserGroupsResponse) => g.id === selectedGroupId)?.groupUsers
              .length
          }{" "}
          <br />
          <strong>Current User:</strong> {user?.id}
        </div>
      )}
    </div>
  );
}

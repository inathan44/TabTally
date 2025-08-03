"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConfettiEffect from "~/components/ConfettiEffect";
import CreateTransactionModal from "~/components/create-transaction-modal";
import { api } from "~/trpc/react";

interface GroupInfoProps {
  groupSlug: string;
}

export default function GroupInfo({ groupSlug }: GroupInfoProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setShowConfetti(true);

      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");

      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;

      router.replace(newUrl);
    }
  }, [searchParams, router]);

  const {
    data: groupResponse,
    error: apiError,
    isPending,
  } = api.group.getGroupBySlug.useQuery({
    slug: groupSlug,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/3 rounded bg-gray-200"></div>
          <div className="mb-2 h-4 w-2/3 rounded bg-gray-200"></div>
          <div className="h-4 w-1/2 rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (apiError) {
    console.error("API Error:", apiError);
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <h2 className="text-xl font-semibold text-red-600">Error loading group</h2>
        <p className="mt-2 text-gray-600">Failed to fetch group data</p>
      </div>
    );
  }

  if (groupResponse?.error) {
    console.error("Error fetching group:", groupResponse.error);
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <h2 className="text-xl font-semibold text-red-600">Error loading group</h2>
        <p className="mt-2 text-gray-600">{groupResponse.error.message}</p>
      </div>
    );
  }

  const group = groupResponse.data;

  return (
    <div className="overflow-x-hidden">
      <ConfettiEffect trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <h1 className="mb-4 text-2xl font-bold break-words text-gray-900">{group.name}</h1>
        {group.description && <p className="mb-6 break-words text-gray-600">{group.description}</p>}

        {/* Group Details */}
        <div className="mb-8 overflow-hidden rounded-lg bg-gray-50 p-4">
          <p className="text-sm break-all text-gray-500">Group ID: {group.id}</p>
          <p className="text-sm break-all text-gray-500">Slug: {group.slug}</p>
        </div>

        {/* Group Members Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Members</h2>
            {group.members && group.members.length > 0 && (
              <div className="flex gap-2">
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                </span>
                {group.members.filter((m) => m.isAdmin).length > 0 && (
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                    {group.members.filter((m) => m.isAdmin).length} admin
                    {group.members.filter((m) => m.isAdmin).length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>

          {group.members && group.members.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center rounded-lg border bg-white p-3 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                    {member.firstName.charAt(0)}
                    {member.lastName.charAt(0)}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium break-words text-gray-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">
                        Joined{" "}
                        {new Date(member.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {/* Admin indicator */}
                      {member.isAdmin && (
                        <div className="flex items-center gap-1">
                          <svg
                            className="h-3 w-3 text-yellow-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-xs font-medium text-yellow-600">
                            {group.createdById === member.id ? "Creator" : "Admin"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">No members found</p>
              <p className="mt-1 text-sm text-gray-400">
                This shouldn&apos;t happen - at least the creator should be a member
              </p>
            </div>
          )}
        </div>

        {/* Transactions Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
            <div className="flex items-center gap-3">
              {group.transactions && group.transactions.length > 0 && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {group.transactions.length} transaction
                  {group.transactions.length !== 1 ? "s" : ""}
                </span>
              )}
              <CreateTransactionModal
                groupId={group.id}
                groupMembers={group.members}
                onSuccess={() => {
                  // Refetch group data to show the new transaction
                  void utils.group.getGroupBySlug.invalidate({ slug: groupSlug });
                }}
              />
            </div>
          </div>
          {group.transactions && group.transactions.length > 0 ? (
            <>
              {/* Transaction Summary */}
              <div className="mb-4 rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Total Group Spending</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${group.transactions.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Average per transaction</p>
                    <p className="text-lg font-semibold text-gray-800">
                      $
                      {(
                        group.transactions.reduce((sum, t) => sum + Number(t.amount), 0) /
                        group.transactions.length
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {group.transactions
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((transaction) => (
                    <div
                      key={transaction.id}
                      className="overflow-hidden rounded-lg border bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="mb-2 sm:mb-0">
                          <h3 className="text-lg font-medium break-words text-gray-900">
                            {transaction.description}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Paid by {transaction.payer.firstName} {transaction.payer.lastName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-green-600">
                            ${Number(transaction.amount).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Transaction Details */}
                      {transaction.transactionDetails &&
                        transaction.transactionDetails.length > 0 && (
                          <div className="mt-3 border-t pt-3">
                            <p className="mb-2 text-sm font-medium text-gray-700">Split details:</p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {transaction.transactionDetails.map((detail) => (
                                <div key={detail.id} className="flex justify-between text-sm">
                                  <span className="break-words text-gray-600">
                                    {detail.recipient.firstName} {detail.recipient.lastName}
                                  </span>
                                  <span className="ml-2 font-medium text-gray-900">
                                    ${Number(detail.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Created by info */}
                      <div className="mt-3 border-t pt-2">
                        <p className="text-xs text-gray-400">
                          Created by {transaction.createdBy.firstName}{" "}
                          {transaction.createdBy.lastName} on{" "}
                          {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">No transactions yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Transactions will appear here once group members start adding expenses
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

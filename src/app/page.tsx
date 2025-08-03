import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Welcome to <span className="text-blue-600">TabTally</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Easily track and split expenses with your friends, family, and groups. Never worry about
            who owes what again.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mt-12">
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/groups"
              className="group rounded-lg border border-gray-200 p-6 shadow-sm transition-all hover:border-blue-500 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Manage Groups</h3>
              <p className="mt-2 text-gray-600">
                View your groups, create new ones, and manage group members.
              </p>
            </Link>

            <Link
              href="/sandbox"
              className="group rounded-lg border border-gray-200 p-6 shadow-sm transition-all hover:border-green-500 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 group-hover:bg-green-200">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Test Features</h3>
              <p className="mt-2 text-gray-600">
                Try out new features and test group creation and transactions.
              </p>
            </Link>

            <div className="group rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <svg
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Track Expenses</h3>
              <p className="mt-2 text-gray-600">
                Create transactions and split bills easily with your group members.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Features</h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white">
                  ✓
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Easy Group Management</h3>
                <p className="mt-2 text-gray-600">
                  Create groups, invite members, and manage permissions with ease.
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white">
                  ✓
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Smart Expense Splitting</h3>
                <p className="mt-2 text-gray-600">
                  Automatically calculate and track who owes what for group expenses.
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white">
                  ✓
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Real-time Updates</h3>
                <p className="mt-2 text-gray-600">
                  See transaction updates instantly across all devices and group members.
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500 text-white">
                  ✓
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Secure & Private</h3>
                <p className="mt-2 text-gray-600">
                  Your financial data is encrypted and only accessible to group members.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

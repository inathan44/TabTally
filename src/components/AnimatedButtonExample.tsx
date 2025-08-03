"use client";

import { AnimatedButton } from "~/components/ui/animated-button";
import { Home, User, Settings, Mail, Bell, Search } from "lucide-react";

export default function AnimatedButtonExample() {
  const handleAsyncAction = async () => {
    // Simulate an API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate random success/failure
    if (Math.random() < 0.7) {
      console.log("Success!");
    } else {
      throw new Error("Something went wrong!");
    }
  };

  const handleSyncAction = () => {
    console.log("Sync action completed");
  };

  return (
    <div className="space-y-6 p-8">
      <h1 className="mb-6 text-2xl font-bold">Animated Button Examples</h1>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Different Loading Animations</h2>
        <div className="flex flex-wrap gap-4">
          <AnimatedButton icon={<Home />} loadingType="spinner" onClick={handleAsyncAction}>
            Spinner
          </AnimatedButton>

          <AnimatedButton icon={<User />} loadingType="dots" onClick={handleAsyncAction} variant="secondary">
            Dots
          </AnimatedButton>

          <AnimatedButton icon={<Settings />} loadingType="pulse" onClick={handleAsyncAction} variant="outline">
            Pulse
          </AnimatedButton>

          <AnimatedButton icon={<Mail />} loadingType="progress" onClick={handleAsyncAction} variant="ghost">
            Progress
          </AnimatedButton>

          <AnimatedButton icon={<Bell />} loadingType="wave" onClick={handleAsyncAction}>
            Wave
          </AnimatedButton>

          <AnimatedButton icon={<Search />} loadingType="bounce" onClick={handleAsyncAction} variant="destructive">
            Bounce
          </AnimatedButton>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Custom States & Text</h2>
        <div className="flex flex-wrap gap-4">
          <AnimatedButton icon={<Settings />} loadingType="spinner" onClick={handleAsyncAction} loadingText="Processing..." successText="Done!" errorText="Oops!" minWidth="120px">
            Custom Text
          </AnimatedButton>

          <AnimatedButton onClick={handleSyncAction} size="sm">
            Quick Action
          </AnimatedButton>

          <AnimatedButton onClick={handleAsyncAction} size="lg" resultDuration={3000}>
            Long Result Display
          </AnimatedButton>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">External State Control</h2>
        <p className="text-sm text-gray-600">You can also control the button state externally using the loading, success, and error props.</p>
        <div className="flex flex-wrap gap-4">
          <AnimatedButton loading={true}>External Loading</AnimatedButton>

          <AnimatedButton success={true}>External Success</AnimatedButton>

          <AnimatedButton error={true}>External Error</AnimatedButton>
        </div>
      </div>
    </div>
  );
}

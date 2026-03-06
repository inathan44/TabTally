"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

const LOADING_STEPS = [
  "Uploading receipt...",
  "Analyzing image...",
  "Extracting line items...",
  "Parsing numbers...",
  "Calculating totals...",
  "Almost there...",
];

const STEP_DURATION_MS = 1800;

export default function ReceiptParserLoading() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, STEP_DURATION_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-border relative overflow-hidden rounded-lg border">
      {/* Animated gradient background */}
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10" />
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        style={{
          animation: "shimmer 2s ease-in-out infinite",
        }}
      />

      <div className="relative flex flex-col items-center gap-4 px-6 py-10">
        {/* Sparkle spinner */}
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-cyan-500/20 blur-md" />
          <div
            className="relative rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 p-3"
            style={{ animation: "spin-slow 3s linear infinite" }}
          >
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Animated dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
              style={{
                animation: `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Cycling status text */}
        <p
          key={stepIndex}
          className="text-muted-foreground text-sm font-medium"
          style={{ animation: "fade-in-up 0.4s ease-out" }}
        >
          {LOADING_STEPS[stepIndex]}
        </p>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes bounce-dot {
          0%,
          80%,
          100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          40% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

type ButtonState = "idle" | "loading" | "success" | "error";

type LoadingType = "spinner" | "dots" | "pulse" | "progress" | "wave" | "bounce";

interface AnimatedButtonProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  /** The button content (text or elements) */
  children: React.ReactNode;
  /** The icon to display in idle state */
  icon?: React.ReactNode;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Type of loading animation */
  loadingType?: LoadingType;
  /** External loading state control */
  loading?: boolean;
  /** External success state control */
  success?: boolean;
  /** External error state control */
  error?: boolean;
  /** Callback when button is clicked */
  onClick?: () => void | Promise<void>;
  /** Minimum button width */
  minWidth?: string;
  /** Custom loading text */
  loadingText?: string;
  /** Custom success text */
  successText?: string;
  /** Custom error text */
  errorText?: string;
  /** Duration to show success/error state before resetting */
  resultDuration?: number;
  /** Whether to render as child */
  asChild?: boolean;
}

export function AnimatedButton({ children, icon, loadingType = "spinner", loading: externalLoading, success: externalSuccess, error: externalError, onClick, minWidth = "100px", loadingText = "Loading...", successText = "Success!", errorText = "Failed", resultDuration = 2000, className, disabled, ...buttonProps }: AnimatedButtonProps) {
  const [internalState, setInternalState] = useState<ButtonState>("idle");

  // Determine current state based on external props or internal state
  const getCurrentState = (): ButtonState => {
    if (externalLoading) return "loading";
    if (externalSuccess) return "success";
    if (externalError) return "error";
    return internalState;
  };

  const currentState = getCurrentState();

  const handleClick = async () => {
    if (currentState === "loading" || disabled) return;
    if (!onClick) return;

    // Only manage internal state if no external state control
    if (externalLoading === undefined && externalSuccess === undefined && externalError === undefined) {
      setInternalState("loading");

      try {
        await onClick();
        setInternalState("success");

        // Reset to idle after showing result
        setTimeout(() => {
          setInternalState("idle");
        }, resultDuration);
      } catch {
        setInternalState("error");

        // Reset to idle after showing result
        setTimeout(() => {
          setInternalState("idle");
        }, resultDuration);
      }
    } else {
      // External state control - just call onClick
      void onClick();
    }
  };

  const renderLoadingAnimation = (type: LoadingType) => {
    switch (type) {
      case "spinner":
        return <Loader2 className="h-4 w-4 animate-spin" />;

      case "dots":
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1 w-1 rounded-full bg-current"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        );

      case "pulse":
        return (
          <motion.div
            className="h-4 w-4 rounded-full bg-current"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />
        );

      case "progress":
        return (
          <div className="h-1 w-8 overflow-hidden rounded-full bg-current/20">
            <motion.div
              className="h-full rounded-full bg-current"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          </div>
        );

      case "wave":
        return (
          <div className="flex space-x-0.5">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-current"
                animate={{
                  height: [4, 12, 4],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.1,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        );

      case "bounce":
        return (
          <motion.div
            className="h-3 w-3 rounded-full bg-current"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeOut",
            }}
          />
        );

      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getButtonContent = () => {
    switch (currentState) {
      case "loading":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center space-x-2">
            {renderLoadingAnimation(loadingType)}
            <span className="text-sm">{loadingText}</span>
          </motion.div>
        );

      case "success":
        return (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center space-x-2 text-green-600">
            <Check className="h-4 w-4" />
            <span className="text-sm">{successText}</span>
          </motion.div>
        );

      case "error":
        return (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center space-x-2 text-red-600">
            <X className="h-4 w-4" />
            <span className="text-sm">{errorText}</span>
          </motion.div>
        );

      default:
        return (
          <div className="flex items-center space-x-2">
            {icon}
            <span className="text-sm">{children}</span>
          </div>
        );
    }
  };

  const getButtonVariant = () => {
    switch (currentState) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "loading":
        return "secondary";
      default:
        return buttonProps.variant ?? "default";
    }
  };

  return (
    <Button {...buttonProps} variant={getButtonVariant()} onClick={handleClick} disabled={disabled ?? currentState === "loading"} className={cn("transition-all duration-300", currentState === "success" && "bg-green-100 hover:bg-green-200", currentState === "error" && "bg-red-100 hover:bg-red-200", currentState === "loading" && "cursor-not-allowed", className)} style={{ minWidth, ...buttonProps.style }}>
      <AnimatePresence mode="wait">
        <motion.div key={currentState} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {getButtonContent()}
        </motion.div>
      </AnimatePresence>
    </Button>
  );
}

"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

interface ConfettiEffectProps {
  trigger?: boolean;
  onComplete?: () => void;
}

const hexColors = ["#2B3E50", "#4B6C8C", "#6C93BF", "#8DAEDA", "#AEE7FF", "#FFC300"];

export default function ConfettiEffect({ trigger = false, onComplete }: ConfettiEffectProps) {
  useEffect(() => {
    if (trigger) {
      // Fire confetti from multiple points across the top of the screen
      const fireConfetti = () => {
        const duration = 3000; // 3 seconds
        const animationEnd = Date.now() + duration;

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        // Initial burst across the top
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            void confetti({
              particleCount: 100,
              spread: 70,
              origin: {
                x: i / 4, // Spread across the top (0, 0.25, 0.5, 0.75, 1)
                y: 0, // Top of screen
              },
              colors: hexColors,
            });
          }, i * 100);
        }

        // Continuous confetti bursts
        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            onComplete?.();
            return;
          }

          // Random bursts from different angles
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          void confetti({
            particleCount: randomInRange(30, 60),
            angle: randomInRange(55, 125),
            spread: randomInRange(50, 80),
            origin: {
              x: randomInRange(0.1, 0.9), // Random x position across screen
              y: 0, // Top of screen
            },
            colors: hexColors,
            gravity: 1.2,
            scalar: 1.2,
            drift: randomInRange(-0.5, 0.5),
          });
        }, 250);
      };

      fireConfetti();
    }
  }, [trigger, onComplete]);

  return null; // This component doesn't render anything visible
}

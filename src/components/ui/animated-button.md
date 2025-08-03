# AnimatedButton Component

A highly customizable button component with smooth animations for loading, success, and error states. Based on the animated navbar example you provided, this component extracts the button logic into a reusable component.

## Features

- 🎨 **6 Different Loading Animations**: spinner, dots, pulse, progress, wave, bounce
- 🎯 **State Management**: Automatic or external state control
- ✅ **Success/Error States**: Animated feedback with customizable icons and text
- 🎭 **Smooth Transitions**: Framer Motion powered animations
- 🎨 **Themeable**: Supports all shadcn/ui button variants
- ⚡ **TypeScript**: Fully typed with excellent IntelliSense support

## Installation

The component requires `framer-motion` which has already been installed:

```bash
npm install framer-motion
```

## Basic Usage

```tsx
import { AnimatedButton } from "~/components/ui/animated-button";
import { Save } from "lucide-react";

function MyComponent() {
  const handleSave = async () => {
    // Your async logic here
    await saveData();
  };

  return (
    <AnimatedButton icon={<Save />} onClick={handleSave} loadingType="spinner">
      Save Data
    </AnimatedButton>
  );
}
```

## Props

| Prop             | Type                          | Default        | Description                         |
| ---------------- | ----------------------------- | -------------- | ----------------------------------- |
| `children`       | `React.ReactNode`             | -              | Button text/content                 |
| `icon`           | `React.ReactNode`             | -              | Icon to display in idle state       |
| `loadingType`    | `LoadingType`                 | `"spinner"`    | Type of loading animation           |
| `loading`        | `boolean`                     | -              | External loading state control      |
| `success`        | `boolean`                     | -              | External success state control      |
| `error`          | `boolean`                     | -              | External error state control        |
| `onClick`        | `() => void \| Promise<void>` | -              | Click handler (sync or async)       |
| `minWidth`       | `string`                      | `"100px"`      | Minimum button width                |
| `loadingText`    | `string`                      | `"Loading..."` | Custom loading text                 |
| `successText`    | `string`                      | `"Success!"`   | Custom success text                 |
| `errorText`      | `string`                      | `"Failed"`     | Custom error text                   |
| `resultDuration` | `number`                      | `2000`         | How long to show success/error (ms) |
| `variant`        | `ButtonVariant`               | `"default"`    | Button variant from shadcn/ui       |
| `size`           | `ButtonSize`                  | `"default"`    | Button size from shadcn/ui          |
| `disabled`       | `boolean`                     | `false`        | Whether button is disabled          |

## Loading Animation Types

- **`spinner`**: Rotating loading icon
- **`dots`**: Three animated dots
- **`pulse`**: Pulsing circle
- **`progress`**: Sliding progress bar
- **`wave`**: Wave-like vertical bars
- **`bounce`**: Bouncing circle

## Examples

### Automatic State Management

The component automatically manages loading, success, and error states when you provide an async `onClick` handler:

```tsx
<AnimatedButton
  icon={<Upload />}
  loadingType="progress"
  onClick={async () => {
    await uploadFile();
    // Automatically shows success or error based on promise resolution
  }}
>
  Upload File
</AnimatedButton>
```

### External State Control

You can control the button state externally:

```tsx
const [isLoading, setIsLoading] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);

<AnimatedButton
  loading={isLoading}
  success={isSuccess}
  onClick={() => {
    setIsLoading(true);
    // Your logic here
  }}
>
  External Control
</AnimatedButton>;
```

### Custom Text and Duration

```tsx
<AnimatedButton loadingText="Processing..." successText="Done!" errorText="Oops!" resultDuration={3000} onClick={handleAction}>
  Custom Messages
</AnimatedButton>
```

### Different Variants and Sizes

```tsx
<AnimatedButton variant="destructive" size="lg">
  Delete Item
</AnimatedButton>

<AnimatedButton variant="outline" size="sm">
  Cancel
</AnimatedButton>
```

## Implementation Notes

- The component extends all standard HTML button props
- Automatic error catching for async functions
- Uses `framer-motion` for smooth animations
- Integrates seamlessly with shadcn/ui design system
- TypeScript friendly with full type safety
- Prevents multiple clicks during loading state
- Clean animations with `AnimatePresence` for state transitions

## See Also

- Check `~/components/AnimatedButtonExample.tsx` for a complete demo
- Based on the animated navbar pattern you provided
- Uses shadcn/ui Button component as the foundation

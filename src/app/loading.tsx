export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

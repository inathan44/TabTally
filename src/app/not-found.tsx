import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-muted-foreground/40">404</p>
        <h2 className="mt-3 text-lg font-semibold text-foreground">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {`Sorry, we couldn't find the page you're looking for.`}
        </p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/">Go back home</Link>
        </Button>
      </div>
    </div>
  );
}

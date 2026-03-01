import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

type AppRoutes =
  | "/"
  | "/sandbox"
  | "/sign-in"
  | "/sign-up"
  | "/api/trpc"
  | "/groups"
  | "/setup"
  | "/profile";

const protectedRoutes: AppRoutes[] = ["/api/trpc", "/sandbox", "/groups", "/setup", "/profile"];

// Convert to route patterns (adding .* for sub-routes)
const protectedRoutePatterns = protectedRoutes.map((route) =>
  route === "/api/trpc" ? "/api/trpc(.*)" : `${route}(.*)`,
);

const isProtectedRoute = createRouteMatcher(protectedRoutePatterns);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

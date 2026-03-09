import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/signin",
  },
});

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/weight/:path*",
    "/food-log/:path*",
    "/chat/:path*",
    "/recipes/:path*",
    "/grocery/:path*",
    "/activity/:path*",
    "/family-space/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};

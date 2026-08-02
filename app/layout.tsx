import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PancakesIcon } from "@/components/icons/Pancakes";
import { logout } from "@/lib/auth/actions";
import { isSignedIn } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pancake Tunes",
  description: "Tunes and sets for the Sunday session, after the pancakes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isSignedIn();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="masthead">
            <h1>
              <Link href="/">
                <PancakesIcon className="brand-mark" width={40} height={40} />
                Pancake Tunes
                <span className="sub">Sunday session</span>
              </Link>
            </h1>
            {signedIn ? (
              <form action={logout}>
                <button type="submit" className="backlink">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="backlink">
                Sign in
              </Link>
            )}
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

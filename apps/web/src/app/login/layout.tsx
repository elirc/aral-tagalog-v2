import type { Metadata } from "next";

// the page itself is a client component, so its title lives here
export const metadata: Metadata = { title: "Log in" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

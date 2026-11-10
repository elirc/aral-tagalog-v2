import type { Metadata } from "next";

// the page itself is a client component, so its title lives here
export const metadata: Metadata = { title: "Create account" };

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

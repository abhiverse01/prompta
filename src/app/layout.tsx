import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open World - 3D Multiplayer",
  description: "A browser-based 3D open-world multiplayer game. No login required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

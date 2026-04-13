import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open World – 3D Multiplayer",
  description: "A browser-based 3D open-world multiplayer game. No login required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden bg-[#0a0a0f] text-white">
        {children}
      </body>
    </html>
  );
}

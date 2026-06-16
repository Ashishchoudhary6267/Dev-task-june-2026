export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col dark bg-[#0a0a0f]">
      <main className="flex-1">{children}</main>
    </div>
  );
}

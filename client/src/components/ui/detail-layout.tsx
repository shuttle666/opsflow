type DetailLayoutProps = {
  main: React.ReactNode;
  sidebar: React.ReactNode;
};

export function DetailLayout({ main, sidebar }: DetailLayoutProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="space-y-6">{sidebar}</aside>
    </div>
  );
}

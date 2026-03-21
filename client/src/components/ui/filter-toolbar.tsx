type FilterToolbarProps = {
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function FilterToolbar({ children, actions }: FilterToolbarProps) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-end">{actions}</div> : null}
    </div>
  );
}

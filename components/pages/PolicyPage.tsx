export function PolicyPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated?: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="mb-12">
        <h1 className="section-title">{title}</h1>
        {updated && <p className="mt-3 text-xs uppercase tracking-[0.15em] text-ink/50">{updated}</p>}
      </header>
      <div className="space-y-8">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="mb-2 text-[15px] font-semibold tracking-wide">{s.title}</h2>
            <p className="text-sm leading-relaxed text-ink/75">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

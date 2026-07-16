export function PolicyPage({
  title,
  sections,
}: {
  title: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="section-title mb-12">{title}</h1>
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

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-7">
      <h1 className="text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-muted">{description}</p>
    </header>
  );
}

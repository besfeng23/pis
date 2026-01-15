export default function IntelPage() {
  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">
          INTEL
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time intelligence feed.
        </p>
      </header>
      <div className="flex h-[50vh] items-center justify-center rounded-lg border-2 border-dashed border-border">
        <p className="text-muted-foreground">Intel feed content goes here.</p>
      </div>
    </div>
  );
}

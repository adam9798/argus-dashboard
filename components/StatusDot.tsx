const TONE_CLASSES = {
  live: "bg-accent shadow-[0_0_8px_var(--accent)]",
  idle: "bg-muted",
  down: "bg-danger shadow-[0_0_8px_var(--danger)]",
} as const;

export function StatusDot({
  tone = "live",
  pulse = true,
}: {
  tone?: keyof typeof TONE_CLASSES;
  pulse?: boolean;
}) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${TONE_CLASSES[tone]}`}
        />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${TONE_CLASSES[tone]}`}
      />
    </span>
  );
}

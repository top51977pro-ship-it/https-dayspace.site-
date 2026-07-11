const dtf = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("he-IL", opts);

export function formatDateTime(ts: number | null | undefined) {
  if (!ts) return "—";
  return dtf({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(ts),
  );
}

export function formatDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return dtf({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(ts));
}

export function formatTime(ts: number | null | undefined) {
  if (!ts) return "—";
  return dtf({ hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

export function relativeFromNow(ts: number | null | undefined) {
  if (!ts) return "אף פעם";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "לפני רגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `לפני ${weeks} שבועות`;
  const months = Math.floor(days / 30);
  if (months < 12) return `לפני ${months} חודשים`;
  return `לפני ${Math.floor(days / 365)} שנים`;
}

export function daysSince(ts: number | null | undefined): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

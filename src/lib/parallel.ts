/** D1 round trips overlap. Local SQLite stays in order so writes do not interleave. */
export function queriesInParallel() {
  if (process.env.PORTAL_PARALLEL_QUERIES === "1") return true;
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export async function gather<T extends unknown[]>(
  tasks: { [K in keyof T]: () => Promise<T[K]> },
  parallel = queriesInParallel(),
): Promise<T> {
  if (!parallel) {
    const out: unknown[] = [];
    for (const task of tasks) out.push(await task());
    return out as T;
  }
  return Promise.all(tasks.map((task) => task())) as Promise<T>;
}

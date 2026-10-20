import { getDb } from "@/db/getDb";
import { publicBenchPortfolio } from "@/lib/bench";

export const metadata = { robots: { index: false, follow: false } };

export default async function BenchPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const person = await publicBenchPortfolio(db, slug);
  if (!person) {
    return <main className="wrap"><h1>Portfolio</h1><p className="note">That bench page is not on file.</p></main>;
  }
  return (
    <main className="wrap">
      <h1>{person.name}</h1>
      <p>UGC portfolio. The bench is free to join.</p>
      {person.niches.length ? <p>{person.niches.join(" · ")}</p> : null}
      {person.platforms.length ? <p>{person.platforms.join(" · ")}</p> : null}
      <ul>
        {person.samples.map((sample) => (
          <li key={sample.title}>{sample.title}</li>
        ))}
      </ul>
      {person.samples.length ? null : <p className="note empty">No samples yet.</p>}
    </main>
  );
}

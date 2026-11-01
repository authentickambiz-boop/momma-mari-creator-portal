import Link from "next/link";
import { START_BASICS, type StartGuide } from "@/lib/where-to-start";

/** First steps and the niche card for a free creator. Managed accounts do not mount this. */
export function WhereToStartGuide({ guide }: { guide: StartGuide }) {
  return (
    <div className="stack" style={{ marginBottom: 14 }}>
      <section className="card" data-start-basics="true">
        <ul className="where-start-basics">
          {START_BASICS.map((step) => <li key={step}>{step}</li>)}
        </ul>
      </section>
      <section className="card" data-where-to-start="true">
        <div className="sec-title">Where to start</div>
        <h2>{guide.headline}</h2>
        <p>{guide.body}</p>
        <p><Link href={`#learn-${guide.topic}`}>Open the lesson</Link></p>
      </section>
      {guide.safety ? <p className="note where-start-safety" data-niche-safety="true">{guide.safety}</p> : null}
    </div>
  );
}

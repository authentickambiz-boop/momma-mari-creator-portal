import type { ProgramRoadmap, RoadmapListItem, RoadmapPart } from "@/lib/program-roadmaps";

function Parts({ parts }: { parts: RoadmapPart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "link") {
          return (
            <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
              {part.text}
            </a>
          );
        }
        if (part.kind === "strong") return <strong key={index}>{part.text}</strong>;
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

function Items({ items, ordered }: { items: RoadmapListItem[]; ordered: boolean }) {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <ListTag>
      {items.map((item, index) => (
        <li key={index}>
          {item.lead ? <strong>{item.lead}</strong> : null}
          {item.lead && item.text ? " " : null}
          {item.text}
          {item.notes && item.notes.length > 0 ? (
            <ul>
              {item.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          ) : null}
        </li>
      ))}
    </ListTag>
  );
}

export function RoadmapBody({ guide }: { guide: ProgramRoadmap }) {
  return (
    <div className="stack">
      {guide.sections.map((section, index) => (
        <section key={section.heading ?? `section-${index}`} className="card">
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.ordered ? <Items items={section.ordered} ordered /> : null}
          {section.bullets ? <Items items={section.bullets} ordered={false} /> : null}
          {section.table ? (
            <table className="roadmap-table">
              <thead>
                <tr>
                  {section.table.headers.map((header) => <th key={header} scope="col">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => <td key={cellIndex}><Parts parts={cell} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** Brands the roster has actually worked with. Text names only. No trademark files are stored here. */
export const WORKED_WITH = [
  "SHEIN",
  "Darry Ring",
  "Levoit",
  "CASETiFY",
  "Dreame",
  "JACKERY",
  "POP MART",
  "Anker",
  "MINISO",
  "celimax",
] as const;

export type CaseStudy = {
  id: string;
  brand: string;
  goal: string;
  deliverables: string;
  results: string;
  quote: string;
  published: boolean;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  published: boolean;
};

/** Empty until a real case study is filled in. Unpublished rows stay off the page. */
export const CASE_STUDIES: CaseStudy[] = [
  { id: "placeholder", brand: "", goal: "", deliverables: "", results: "", quote: "", published: false },
];

/** Empty until a real quote is filled in. Unpublished rows stay off the page. */
export const TESTIMONIALS: Testimonial[] = [
  { id: "placeholder", quote: "", name: "", published: false },
];

export function visibleCaseStudies(rows: CaseStudy[] = CASE_STUDIES) {
  return rows.filter((item) => item.published && item.brand.trim() && item.results.trim());
}

export function visibleTestimonials(rows: Testimonial[] = TESTIMONIALS) {
  return rows.filter((item) => item.published && item.quote.trim() && item.name.trim());
}

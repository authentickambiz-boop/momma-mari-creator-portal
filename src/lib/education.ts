export const LESSONS = [
  {
    id: "deals",
    title: "How deals work",
    body: [
      "A brand writes to Momma Mari. Kamron screens the offer before a creator sees it.",
      "When an offer is shared, it shows the deliverables, the dates, and how the brand wants to use the post. The creator can say yes or no.",
      "A yes moves into a contract, then a draft, then the post. The brand pays the invoice. The creator is paid after that money arrives.",
      "This page does not sign a contract and it does not send email.",
    ],
  },
  {
    id: "rates",
    title: "Rates and negotiation",
    body: [
      "Talk about the work before talking about a number. Count the posts, the platforms, the edits, and the timeline.",
      "Usage changes the offer. One organic post is a smaller yes than a post the brand can run as an ad for months. Exclusivity, a rush date, and raw footage are their own asks.",
      "Momma Mari keeps 20 percent and the creator keeps 80 percent of what is left after the brand pays. Ask Kamron to carry the number conversation with the brand.",
      "If a budget does not fit the scope, the answer can be a smaller scope or another creator on the roster. Do not quote a private floor in a public note or a brand email.",
    ],
  },
  {
    id: "usage",
    title: "Usage rights",
    body: [
      "Organic use means the brand can share the post on its own channels. It does not mean they can put money behind it.",
      "Paid use, whitelisting, and Spark codes let the brand run ads. Those need a separate yes, a start date, an end date, and the places they can run.",
      "When the window ends, the brand needs a new yes to keep using the work. Write the window in the agreement instead of leaving it as 'for the campaign.'",
    ],
  },
  {
    id: "ftc",
    title: "FTC disclosure and gifted deals",
    body: [
      "If a brand paid, or sent a product, say so where a viewer can see it. A clear 'ad' or 'paid partnership' label is the habit. Hiding the relationship is not allowed.",
      "A gifted offer is still a brand deal. Thank them. Kamron can match the product to a creator who takes gifted work. Do not promise a post before the product and the terms are clear.",
      "A gifted post still needs the disclosure. A free product is a form of payment.",
    ],
  },
] as const;

const REVIEW = "template, have a lawyer review";

function template(title: string, paragraphs: string[]) {
  return [`${title}`, REVIEW, "", ...paragraphs].join("\n");
}

export const EDUCATION_TEMPLATES = [
  {
    slug: "brand-agreement",
    title: "Brand agreement",
    filename: "momma-mari-brand-agreement.txt",
    body: template("Brand agreement", [
      "Parties: Momma Mari LLC and ________________ (brand).",
      "Creator: ________________.",
      "Deliverables: platform, count, and format: ________________.",
      "Fee: ________________. Payment terms: Net ____.",
      "Usage: organic only / paid ads. Starts ________. Ends ________. Territory: ________.",
      "Exclusivity: ________________, or none.",
      "Draft due ________. Post window ________. Approval rounds: ____.",
      "The creator will disclose the paid partnership in the post.",
      "Either side can cancel in writing before the draft is filmed. A cancellation after filming is talked through with Kamron.",
      "This is a starting point for the owner and a lawyer. It is not signed from the portal.",
    ]),
  },
  {
    slug: "gifted-agreement",
    title: "Gifted agreement",
    filename: "momma-mari-gifted-agreement.txt",
    body: template("Gifted agreement", [
      "Brand: ________________. Creator: ________________.",
      "Product: ________________. Estimated product value, if the brand provides one: ________________.",
      "No fee is due for this gift. The creator is not required to post until the product arrives and the terms below are accepted.",
      "If the creator posts, the post goes up by ________ and includes a clear disclosure that the product was gifted.",
      "Usage of a gifted post is organic on the brand's own channels for ____ days, unless a usage addendum says otherwise.",
      "The creator may decline after trying the product. The brand may ask for the product back only if that was agreed here: ________________.",
      "This is a starting point for the owner and a lawyer. It is not signed from the portal.",
    ]),
  },
  {
    slug: "usage-addendum",
    title: "Usage addendum",
    filename: "momma-mari-usage-addendum.txt",
    body: template("Usage addendum", [
      "This addendum is attached to the agreement with ________________ (brand) for ________________ (creator).",
      "Organic reposts: yes / no. Paid ads or whitelisting: yes / no. Spark or partnership code: yes / no.",
      "Starts ________. Ends ________. Territory: ________.",
      "Extra fee for this usage, if any: ________________.",
      "When the end date passes, the brand stops using the work unless both sides extend this addendum in writing.",
      "This is a starting point for the owner and a lawyer. It is not signed from the portal.",
    ]),
  },
] as const;

export function educationTemplate(slug: string) {
  return EDUCATION_TEMPLATES.find((item) => item.slug === slug) ?? null;
}

export type HelpArticle = {
  slug: string;
  title: string;
  audience: string;
  body: string;
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "creators",
    title: "Creators",
    audience: "Creators",
    body: `Sign in with the Google account Kamron has on file. If your legal name, mailing address, phone, or handles are missing, the portal asks you to complete your profile before anything else.

Your home shows your own deals. A deal stays hidden until Kamron releases it. You can accept, counter, or pass an offer from that list.

Drafts, dates, and payout notes stay on your sign-in. Another creator cannot open them.

Questions go to the support form. The note is saved in the portal. Nothing is emailed from it.`,
  },
  {
    slug: "brands",
    title: "Brands",
    audience: "Brands",
    body: `Tell us about a campaign on the inquiry form. A Holiday Gift Guide reservation uses the same form with the gift-guide program. Reserving a spot does not charge a card.

The public roster lists creators and follower counts. It does not list what a creator charges.

Brand accounts that sign in and browse a private roster are not open yet. Kamron invites a brand after a deal has gone well.`,
  },
  {
    slug: "payments",
    title: "Payments",
    audience: "Payments",
    body: `The portal does not charge a card and does not send a payout on its own.

Kamron records when a brand has paid Momma Mari and when a creator's share was sent. A creator sees those marks on her own deals. A manager does not see amounts.

A support note about a payment stays in the portal. Nothing is emailed from the form.`,
  },
  {
    slug: "privacy",
    title: "Privacy",
    audience: "Privacy",
    body: `The privacy policy is on the Privacy page. It covers the public site and the portal.

Forms on this site save what you type in the portal. They do not send a marketing email on their own.

A creator sees her own deals, drafts, and notes. Kamron can see the roster. A manager sees only the creators assigned to them.`,
  },
  {
    slug: "kids-in-content",
    title: "Kids in content",
    audience: "Kids in content",
    body: `Read Kids in content for the standard Momma Mari uses when a child appears in a post.

Applications ask for age ranges only. Do not add a child's name or birthday.

If a brief is not a fit for that standard, say so in the support form. The note stays in the portal.`,
  },
];

export function searchHelp(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((article) => (
    article.title.toLowerCase().includes(needle)
    || article.audience.toLowerCase().includes(needle)
    || article.body.toLowerCase().includes(needle)
  ));
}

export function helpArticle(slug: string) {
  return HELP_ARTICLES.find((article) => article.slug === slug) ?? null;
}

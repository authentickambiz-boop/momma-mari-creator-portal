/** Creator planning guides approved Oct 23, 2026 (P-BEAUTY1). No rates or deal terms. */

export const PROGRAM_DATES_LINE =
  "Program dates change every year, so always check the official page before applying. You apply yourself; Momma Mari can help you prepare.";

export type RoadmapPart =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; href: string; text: string };

export type RoadmapListItem = {
  lead?: string;
  text: string;
  notes?: string[];
};

export type RoadmapSection = {
  heading?: string;
  ordered?: RoadmapListItem[];
  bullets?: RoadmapListItem[];
  table?: {
    headers: string[];
    rows: RoadmapPart[][][];
  };
};

export type ProgramRoadmap = {
  slug: string;
  title: string;
  lede: string;
  sections: RoadmapSection[];
};

const text = (value: string): RoadmapPart[] => [{ kind: "text", text: value }];
const strong = (value: string): RoadmapPart[] => [{ kind: "strong", text: value }];
const link = (href: string): RoadmapPart[] => [{ kind: "link", href, text: href }];

function textRow(values: string[]): RoadmapPart[][] {
  return values.map((value) => text(value));
}

const WEEK_HEADERS = ["Weeks", "Focus", "Posts per week", "Goal"];

export const PROGRAM_ROADMAPS: ProgramRoadmap[] = [
  {
    slug: "beauty",
    title: "Beauty content roadmap",
    lede: "For any Momma Mari creator who wants to grow beauty content, whether you're a full-time beauty creator or a busy parent who does a 5-minute face.",
    sections: [
      {
        heading: "Your three core formats",
        ordered: [
          {
            lead: "Get Ready With Me (GRWM).",
            text: "Talk while you get ready. The beauty is the backdrop; the story is the hook (\"GRWM for my first night out since the baby\", \"GRWM: school pickup to date night\").",
            notes: [
              "Keep it 45–90 seconds, show the products clearly once, and name every product on screen or in the caption.",
            ],
          },
          {
            lead: "Tutorials.",
            text: "One look, step by step. Hook with the finished look in the first 2 seconds, then rewind.",
            notes: [
              "Series ideas: \"5-minute mom makeup\", \"drugstore vs. splurge\", \"one product, three ways\", \"fix my mistakes\".",
            ],
          },
          {
            lead: "Makeover series.",
            text: "Multi-part transformations: a partner, a friend, a grandparent, or yourself over 30 days.",
            notes: [
              "Part 1 is the reveal teaser, Parts 2–4 are the process, and the final part is the before and after. Series keep people coming back and brands love them.",
            ],
          },
        ],
      },
      {
        heading: "Content pillars to rotate",
        bullets: [
          { text: "Routines (morning, night, gym, travel)" },
          { text: "Real reviews (first impressions, 30-day results, empties)" },
          { text: "Seasonal looks (holiday party, Valentine's, spring brights, summer sweat-proof)" },
          { text: "Hair and nails (quick hairstyles, at-home gel nails, kid-friendly hair for parents)" },
          { text: "Shopping hauls (store runs, sale picks, \"what I'd buy with $50\")" },
        ],
      },
      {
        heading: "12-week starter plan",
        table: {
          headers: WEEK_HEADERS,
          rows: [
            textRow(["1–2", "Film 3 GRWMs and 2 tutorials; test hooks", "4–5", "Find which format your audience saves and shares"]),
            textRow(["3–4", "Start a makeover or 30-day series", "4–5", "Build return viewers"]),
            textRow(["5–6", "Add reviews: first impressions + empties", "4–5", "Show brands you give honest, detailed reviews"]),
            textRow(["7–8", "Seasonal looks tied to the calendar below", "5", "Line up with retailer moments"]),
            textRow(["9–10", "Collabs: duet or stitch other creators; one live", "5", "Grow reach"]),
            textRow(["11–12", "Make a \"best of\" highlight reel and share it with Momma Mari", "4", "Media-kit material for brand pitches"]),
          ],
        },
      },
      {
        heading: "Seasonal beauty moments",
        bullets: [
          { lead: "Jan:", text: "new-year skin reset, \"products I'm keeping in 2027\"" },
          { lead: "Feb:", text: "Valentine's looks, self-care night" },
          { lead: "Mar–Apr:", text: "spring refresh, Ulta 21 Days of Beauty (usually March–April)" },
          { lead: "May:", text: "Mother's Day gifts, prom and graduation" },
          { lead: "Jun–Aug:", text: "sweat-proof makeup, SPF, travel kits, back-to-school routines" },
          { lead: "Sep–Oct:", text: "fall colors, Halloween looks" },
          { lead: "Nov–Dec:", text: "Black Friday and holiday gift guides, party looks, Sephora and Ulta holiday events" },
        ],
      },
      {
        heading: "Checklist for every beauty post",
        bullets: [
          { text: "Good light on your face (window light or a ring light in front of you, not behind)" },
          { text: "Products shown clearly, label facing the camera" },
          { text: "A hook in the first 2 seconds" },
          { text: "Disclose any gifted or paid product (#ad, or the platform's paid-partnership label)" },
          { text: "Pinned comment or caption with product names" },
        ],
      },
    ],
  },
  {
    slug: "diy-home",
    title: "DIY and home content roadmap",
    lede: "For creators who want to share home projects, organizing, decor and family-friendly DIY.",
    sections: [
      {
        heading: "Core formats",
        ordered: [
          {
            lead: "Before and after.",
            text: "The single most shared home format. Film the \"before\" on a tripod from the same spot you'll film the \"after\".",
          },
          {
            lead: "Step-by-step project.",
            text: "One project, 30–90 seconds, with the tools and materials listed on screen.",
          },
          {
            lead: "Room makeover series.",
            text: "One room over 3–6 parts: the plan, the budget, the build, the reveal.",
          },
          {
            lead: "Hacks and organizing.",
            text: "Pantry, playroom, garage, closet. Quick wins people can copy this weekend.",
          },
          {
            lead: "Seasonal decor.",
            text: "Porch, mantel and table setups for each holiday.",
          },
        ],
      },
      {
        heading: "Content pillars",
        bullets: [
          { text: "Weekend projects (under one day)" },
          { text: "Renter-friendly upgrades" },
          { text: "Kid and family spaces (playroom, nursery, homework nook)" },
          { text: "Outdoor and yard (garden beds, patio, holiday lights)" },
          { text: "Tool basics (\"first tool kit\", \"how to use a drill\")" },
        ],
      },
      {
        heading: "12-week starter plan",
        table: {
          headers: WEEK_HEADERS,
          rows: [
            textRow(["1–2", "3 quick hacks + 1 before-and-after", "4", "Learn what your audience saves"]),
            textRow(["3–6", "One room makeover series", "3–4", "Build a story people follow"]),
            textRow(["7–8", "Seasonal decor tied to the calendar", "4–5", "Match retailer seasonal pushes"]),
            textRow(["9–10", "Tool or skill tutorials", "4", "Show expertise (brands look for this)"]),
            textRow(["11–12", "Highlight reel + project list for Momma Mari", "3–4", "Media-kit material"]),
          ],
        },
      },
      {
        heading: "Seasonal home moments",
        bullets: [
          { lead: "Jan:", text: "organizing and decluttering" },
          { lead: "Feb–Mar:", text: "spring cleaning, garden planning" },
          { lead: "Apr–May:", text: "spring sales at home stores (Lowe's and Home Depot spring events), outdoor projects, Mother's Day" },
          { lead: "Jun–Aug:", text: "patio, grilling, back-to-school spaces" },
          { lead: "Sep–Oct:", text: "fall porch, Halloween decor" },
          { lead: "Nov–Dec:", text: "holiday decor, gift ideas, hosting prep" },
        ],
      },
      {
        heading: "Checklist",
        bullets: [
          { text: "Tripod shots from a fixed spot for before and after" },
          { text: "Show safety gear when using tools" },
          { text: "List materials and approximate time on screen" },
          { text: "Disclose any gifted or paid product" },
        ],
      },
    ],
  },
  {
    slug: "retailer-calendar",
    title: "Retailer creator program calendar",
    lede: `Checked Oct 23, 2026. ${PROGRAM_DATES_LINE} No rates are listed here.`,
    sections: [
      {
        table: {
          headers: ["Program", "What it is", "When", "Official page", "How to prepare"],
          rows: [
            [
              strong("Sephora Squad"),
              text("Yearlong paid creator partnership with Sephora, plus product, events and a storefront. Open to US creators 18+ with an active Instagram or TikTok; Sephora says follower count matters less than engagement."),
              text("2026 window was Sep 15–Oct 6 (closed); class announced Jan 2027. Expect the next window around mid-September 2027."),
              [
                { kind: "link", href: "https://www.sephorasquad.com/", text: "https://www.sephorasquad.com/" },
                { kind: "text", text: " (FAQ: " },
                { kind: "link", href: "https://www.sephorasquad.com/faq", text: "https://www.sephorasquad.com/faq" },
                { kind: "text", text: ")" },
              ],
              text("You must fill it out yourself (managers can't submit). Have a high-res headshot, your links, and ask followers for testimonials during the window. Build Sephora-product beauty content through the summer."),
            ],
            [
              strong("Ulta Beauty Collective"),
              text("Ulta's selective creator community."),
              text("2026 applications are closed; Ulta announced the class in summer. Watch for the next window in 2027."),
              link("https://www.ubcollective.com/"),
              text("Post consistent beauty content featuring Ulta-carried brands; keep a highlight reel ready."),
            ],
            [
              strong("UB Creates (Ulta)"),
              text("Ulta's affiliate program for social creators. Commission-based, free to join, no website needed."),
              text("Open now (rolling)."),
              link("https://www.ulta.com/company/affiliate"),
              text("Good first step for beauty creators; use it during 21 Days of Beauty (spring) and holiday."),
            ],
            [
              strong("The Home Depot Creator"),
              text("Home Depot's creator portal: commission on shoppable links, campaign opportunities, product gifting, training."),
              text("Open to the public since Dec 10, 2025 (rolling)."),
              link("https://creators.homedepot.com/"),
              text("DIY, decor, tools, outdoor. Line content up with spring, back-to-school and holiday decor."),
            ],
            [
              strong("Lowe's Creator Program"),
              text("Lowe's affiliate creator program, open to US creators. (Lowe's HQ is in Mooresville.)"),
              text("Open (rolling)."),
              [
                { kind: "link", href: "https://www.lowes.com/l/creator/joinlowescreator", text: "https://www.lowes.com/l/creator/joinlowescreator" },
                { kind: "text", text: " (page blocks automated checks; open in a browser)" },
              ],
              text("Same as Home Depot. Local Lake Norman creators have a home-turf story to tell."),
            ],
          ],
        },
      },
      {
        heading: "Year at a glance",
        bullets: [
          { lead: "Jan:", text: "Sephora Squad class revealed; organizing and new-year content (Home Depot, Lowe's)" },
          { lead: "Mar–Apr:", text: "Ulta 21 Days of Beauty; spring home projects" },
          { lead: "Summer:", text: "Ulta Beauty Collective class announced; start building Sephora-product content" },
          { lead: "Mid-Sep–early Oct:", text: "Sephora Squad applications (verify dates)" },
          { lead: "Nov–Dec:", text: "holiday beauty and decor, gift guides, Black Friday" },
        ],
      },
    ],
  },
];

export function programRoadmap(slug: string) {
  return PROGRAM_ROADMAPS.find((guide) => guide.slug === slug) ?? null;
}

export function roadmapPath(slug: string | null, creatorId: string | null) {
  const path = slug ? `/roadmaps/${slug}` : "/roadmaps";
  if (!creatorId) return path;
  return `${path}?creator=${encodeURIComponent(creatorId)}`;
}

export function roadmapPlainText(guide: ProgramRoadmap) {
  const chunks: string[] = [guide.title, guide.lede];
  for (const section of guide.sections) {
    if (section.heading) chunks.push(section.heading);
    for (const item of [...(section.ordered ?? []), ...(section.bullets ?? [])]) {
      if (item.lead) chunks.push(item.lead);
      chunks.push(item.text);
      chunks.push(...(item.notes ?? []));
    }
    for (const header of section.table?.headers ?? []) chunks.push(header);
    for (const row of section.table?.rows ?? []) {
      for (const cell of row) {
        for (const part of cell) chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n");
}

export function roadmapOfficialHrefs(guide: ProgramRoadmap) {
  const hrefs: string[] = [];
  for (const section of guide.sections) {
    for (const row of section.table?.rows ?? []) {
      for (const cell of row) {
        for (const part of cell) {
          if (part.kind === "link") hrefs.push(part.href);
        }
      }
    }
  }
  return hrefs;
}

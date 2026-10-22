import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
const embed = require("../public/seasonal/embed.js") as {
  RANK_LABELS: string[];
  RANK_HOW: string;
  RANK_INTRO: string;
  STORY_IMAGE: string;
  FOUNDER_IMAGE: string;
  FLOATERS: { kind: string; top: string; left: string; size: number }[];
  applyPublishedFixes: (doc: Doc) => void;
};

type Child = El | string;

class El {
  tagName: string;
  children: Child[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  parentNode: El | null = null;
  ownerDocument: Doc;
  private classValue = "";

  constructor(tag: string, doc: Doc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
  }

  get className() {
    return this.classValue;
  }

  set className(value: string) {
    this.classValue = value;
    this.attrs.class = value;
  }

  get textContent(): string {
    return this.children.map((child) => (typeof child === "string" ? child : child.textContent)).join("");
  }

  set textContent(value: string) {
    this.children = value ? [String(value)] : [];
  }

  setAttribute(key: string, value: string) {
    this.attrs[key] = String(value);
    if (key === "class") this.classValue = String(value);
  }

  getAttribute(key: string) {
    return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
  }

  hasAttribute(key: string) {
    return Object.prototype.hasOwnProperty.call(this.attrs, key);
  }

  removeAttribute(key: string) {
    delete this.attrs[key];
  }

  appendChild(child: El) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child: El, ref: El | null) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const index = ref ? this.children.indexOf(ref) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child: El) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
  }

  replaceChild(next: El, prev: El) {
    const index = this.children.indexOf(prev);
    if (index < 0) throw new Error("missing child");
    if (next.parentNode) next.parentNode.removeChild(next);
    next.parentNode = this;
    prev.parentNode = null;
    this.children[index] = next;
    return prev;
  }

  cloneNode(deep?: boolean): El {
    const copy = new El(this.tagName.toLowerCase(), this.ownerDocument);
    copy.classValue = this.classValue;
    copy.attrs = { ...this.attrs };
    copy.style = { ...this.style };
    if (deep) {
      for (const child of this.children) {
        if (typeof child === "string") copy.children.push(child);
        else copy.appendChild(child.cloneNode(true));
      }
    }
    return copy;
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): El[] {
    const parts = selector.split(",").map((part) => part.trim()).filter(Boolean);
    const found: El[] = [];
    const walk = (node: El) => {
      for (const child of node.children) {
        if (typeof child === "string") continue;
        if (parts.some((part) => matches(child, part))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

class Doc {
  documentElement: El;
  constructor() {
    this.documentElement = new El("html", this);
  }
  createElement(tag: string) {
    return new El(tag, this);
  }
  querySelector(selector: string) {
    return this.documentElement.querySelector(selector);
  }
  querySelectorAll(selector: string) {
    return this.documentElement.querySelectorAll(selector);
  }
}

function matches(el: El, selector: string) {
  if (selector.startsWith("[")) {
    const attr = /^\[([\w-]+)=["']([^"']+)["']\]$/.exec(selector);
    return Boolean(attr && el.attrs[attr[1]] === attr[2]);
  }
  const pieces = selector.split(".");
  const tag = pieces[0];
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  const classes = el.className.split(/\s+/).filter(Boolean);
  for (const name of pieces.slice(1)) {
    if (!classes.includes(name)) return false;
  }
  return Boolean(tag) || pieces.length > 1;
}

function el(doc: Doc, tag: string, attrs: Record<string, string>, children: Child[] = []) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === "string") node.children.push(child);
    else node.appendChild(child);
  }
  return node;
}

function samplePage() {
  const doc = new Doc();
  const body = el(doc, "body", {});
  doc.documentElement.appendChild(body);
  const scene = el(doc, "div", { class: "mm-scene" }, ["ghost stays"]);
  body.appendChild(scene);

  const career = el(doc, "section", { class: "section cta" });
  const cta = el(doc, "div", { class: "content-cta", "trail-image": "component" });
  const list = el(doc, "div", { class: "trail-collection w-dyn-list" });
  const items = el(doc, "div", { class: "list-images-cta", "trail-image": "list" });
  items.appendChild(el(doc, "img", { class: "cta-img", src: "https://cdn.example/neon-1.jpeg", alt: "Haven" }));
  items.appendChild(el(doc, "img", { class: "cta-img", src: "https://cdn.example/neon-2.jpeg", alt: "Nebula" }));
  list.appendChild(items);
  cta.appendChild(list);
  const button = el(doc, "div", { class: "cta-button" }, [
    el(doc, "h2", { class: "display-1" }, ["Ready to Grow Your Creator Career?"]),
    el(doc, "a", { href: "https://mommamari.com/portal/apply" }, ["Apply Now"]),
    el(doc, "a", { href: "/contact" }, ["Work with Us"]),
  ]);
  cta.appendChild(button);
  career.appendChild(cta);
  body.appendChild(career);

  const ranks = el(doc, "section", {});
  ranks.appendChild(el(doc, "h6", { class: "centered-heading" }, ["Creator Income Tiers"]));
  ranks.appendChild(el(doc, "div", { class: "sub-heading" }, [
    "Creators are categorized based on expected monthly income rather than follower count.",
  ]));
  const oldNames = ["Development", "Emerging", "Rising", "Established", "Professional", "Advanced", "Elite", "Premier", "Icon", "Legend"];
  oldNames.forEach((name, index) => {
    const box = el(doc, "div", { class: "income-tiers-box-wrapper" }, [
      el(doc, "div", { class: "new-tier" }, [`Tier ${index + 1}`]),
      el(doc, "p", { class: "desination" }, [name]),
      el(doc, "p", { class: "paragraph-4" }, [`$${index + 1}00 / month`]),
      el(doc, "p", { class: "reson" }, ["Entry-level creators with brand deals."]),
    ]);
    ranks.appendChild(box);
  });
  ranks.appendChild(el(doc, "p", {}, ["Review tier placement and expectations"]));
  ranks.appendChild(el(doc, "p", {}, ["Monthly performance reviews"]));
  body.appendChild(ranks);

  const story = el(doc, "img", {
    class: "about-img",
    src: "https://cdn.prod.website-files.com/6930c02a157263872fbd655d/6930c02c157263872fbd65de_Neon%20Portrait%20Art.jpeg",
    srcset: "https://cdn.example/neon-500.jpeg 500w",
    alt: "The Momma Mari story",
  });
  body.appendChild(story);
  const team = el(doc, "div", { class: "our-team-card" }, [
    el(doc, "img", {
      class: "our-team-img",
      src: "https://cdn.example/photo-1494790108377-be9c29b29330.jpeg",
      alt: "Kib Healthcare",
    }),
    el(doc, "div", { class: "course-details-text" }, ["Kamron Santo"]),
    el(doc, "div", { class: "desination-text" }, ["Founder"]),
  ]);
  body.appendChild(team);
  return { doc, scene };
}

describe("published marketing-site fixes", () => {
  test("uses the ten portal rank names and the real creator photos", () => {
    assert.deepEqual(embed.RANK_LABELS, [
      "Seedling", "Sprout", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Ruby", "Sapphire", "Diamond",
    ]);
    assert.equal(embed.RANK_HOW, "How to reach this rank: details coming soon");
    assert.match(embed.RANK_INTRO, /0-100 creator score/);
    assert.match(embed.STORY_IMAGE, /6ad2680fd6b2cc409007c310/);
    assert.match(embed.FOUNDER_IMAGE, /6ad268743448708cf2d55775/);
    assert.equal(embed.FLOATERS.filter((item) => item.kind === "ghost").length, 3);
    assert.equal(embed.FLOATERS[0].top, "14%");
    assert.equal(embed.FLOATERS[0].left, "12%");
    assert.equal(embed.FLOATERS[0].size, 120);
  });

  test("rewrites the live income tiers, trail, and about photos without moving the scene", () => {
    const { doc, scene } = samplePage();
    embed.applyPublishedFixes(doc);
    embed.applyPublishedFixes(doc);

    assert.equal(scene.textContent, "ghost stays");
    assert.equal(scene.className, "mm-scene");

    const stills = doc.querySelectorAll(".mm-cta-still");
    assert.equal(stills.length, 1);
    const photo = stills[0].querySelector("img");
    assert.equal(photo?.getAttribute("src"), embed.STORY_IMAGE);
    assert.equal(photo?.getAttribute("alt"), "MariClare, Momma Mari creator");
    assert.equal(doc.querySelector(".trail-collection")?.style.display, "none");
    assert.equal(doc.querySelector("h2")?.textContent, "Ready to Grow Your Creator Career?");
    assert.match(doc.documentElement.textContent, /Apply Now/);
    assert.match(doc.documentElement.textContent, /Work with Us/);
    assert.equal(doc.querySelectorAll(".cta-img").length, 2);

    assert.equal(doc.querySelector(".centered-heading")?.textContent, "Creator Ranks");
    assert.equal(doc.querySelector(".sub-heading")?.textContent, embed.RANK_INTRO);
    const boxes = doc.querySelectorAll(".income-tiers-box-wrapper");
    assert.equal(boxes.length, 10);
    boxes.forEach((box, index) => {
      assert.equal(box.querySelector(".new-tier")?.textContent, `Tier ${index + 1}`);
      assert.equal(box.querySelector(".desination")?.textContent, embed.RANK_LABELS[index]);
      assert.equal(box.querySelector(".paragraph-4")?.textContent, embed.RANK_HOW);
      assert.equal(box.querySelector(".reson")?.textContent, "");
      assert.equal(box.getAttribute("data-mm-rank"), embed.RANK_LABELS[index].toLowerCase());
    });
    assert.equal(doc.documentElement.textContent.includes("$"), false);
    assert.match(doc.documentElement.textContent, /Review tier placement and expectations/);
    assert.match(doc.documentElement.textContent, /Monthly performance reviews/);

    const story = doc.querySelector("img.about-img");
    assert.equal(story?.getAttribute("src"), embed.STORY_IMAGE);
    assert.equal(story?.getAttribute("alt"), "MariClare, Momma Mari creator");
    assert.equal(story?.getAttribute("srcset"), null);
    const founder = doc.querySelector(".our-team-card")?.querySelector("img");
    assert.equal(founder?.getAttribute("src"), embed.FOUNDER_IMAGE);
    assert.equal(founder?.getAttribute("alt"), "Kamron Santo, founder of Momma Mari");
  });
});

import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { helpArticle, HELP_ARTICLES } from "@/lib/help-center";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = helpArticle(slug);
  return {
    ...publicPageMeta({
      title: article ? `${article.title} · Momma Mari help` : "Help",
      description: article?.body.slice(0, 140) ?? "Momma Mari help.",
      path: `/help/${slug}`,
    }),
    robots: PUBLIC_ROBOTS,
  };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = helpArticle(slug);
  if (!article) notFound();
  return (
    <PublicShell title={article.title} lede={article.audience}>
      {article.body.split(/\n\n+/).map((block) => <p key={block.slice(0, 40)}>{block}</p>)}
      <p><Link href="/help">All help</Link></p>
    </PublicShell>
  );
}

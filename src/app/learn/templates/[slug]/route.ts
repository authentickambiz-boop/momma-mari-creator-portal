import { NextResponse } from "next/server";
import { currentViewer } from "@/lib/current-user";
import { educationTemplate } from "@/lib/education";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await context.params;
  const template = educationTemplate(slug);
  if (!template) return NextResponse.json({ error: "That template was not found." }, { status: 404 });
  return new NextResponse(template.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "X-Robots-Tag": "noindex",
    },
  });
}

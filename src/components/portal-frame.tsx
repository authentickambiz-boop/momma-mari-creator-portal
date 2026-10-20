import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { TabRow } from "@/components/tab-row";
import { accountMenuItems } from "@/lib/creator-home";
import { withBasePath } from "@/lib/format";
import { visiblePortalTabs, type PortalTab } from "@/lib/portal-tabs";
import type { CreatorProfile, Viewer } from "@/lib/types";

export type { PortalTab };

export function PortalFrame({
  viewer,
  tab,
  creators,
  viewedId,
  hello,
  children,
}: {
  viewer: Viewer;
  tab: PortalTab;
  creators: CreatorProfile[];
  viewedId: string | "all";
  hello: React.ReactNode;
  children: React.ReactNode;
}) {
  const staff = viewer.role === "admin" || viewer.role === "manager";
  const query = (id: string) => (staff ? `?creator=${id}` : "");
  const tabs = visiblePortalTabs(viewer);
  const menu = accountMenuItems(viewer.role);
  return (
    <>
      <div className="sticky-chrome">
      <div className="demo-bar">
        Pilot. MariClare&apos;s deals are seed data from her inbox as of Oct 17, 2026. TBD means the emails don&apos;t say yet.
      </div>
      <header className="top">
        <Link href={staff ? `/${query(viewedId === "all" ? "mariclare" : viewedId)}` : "/"} className="brand">
          <img className="logo-img" src={withBasePath("/momma-logo.png")} alt="" />
          <div>
            <strong>Momma Mari</strong>
            <small>Creator Portal</small>
          </div>
        </Link>
        <div className="me">
          <span className="who">Signed in as {viewer.name}</span>
          <AccountMenu initials={viewer.initials || viewer.name.slice(0, 1)} items={menu} />
        </div>
      </header>
      </div>
      <div className="wrap">
        {hello}
        {staff ? (
          <div className="switcher">
            {creators.map((creator) => (
              <Link key={creator.id} href={`${tab === "deals" ? "/" : `/${tab}`}${query(creator.id)}`} className={viewedId === creator.id ? "on" : ""}>
                {creator.name}
              </Link>
            ))}
            <Link href={`${tab === "deals" ? "/" : `/${tab}`}?creator=all`} className={viewedId === "all" ? "on" : ""}>
              {viewer.role === "manager" ? "My creators" : "All creators"}
            </Link>
          </div>
        ) : null}
        <TabRow>
          {tabs.map((item) => (
            <Link key={item.id} href={`${item.href}${query(viewedId)}`} className={item.id === tab ? "on" : ""}>
              {item.label}
            </Link>
          ))}
        </TabRow>
        {viewer.role === "admin" && viewedId !== "all" ? (
          <div className="admin-banner">
            You&apos;re signed in as Kamron. This is {creators.find((creator) => creator.id === viewedId)?.name}&apos;s portal.
            She can&apos;t see hidden deals or your notes.
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}

export function MaybeTbd({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="tbd">TBD</span>;
  if (/^TBD\b/.test(value)) return <span className="tbd">{value}</span>;
  return <>{value}</>;
}

export function Chips({ chips }: { chips: { text: string; tone: string }[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span key={chip.text} className={`chip ${chip.tone}`}>{chip.text}</span>
      ))}
    </>
  );
}

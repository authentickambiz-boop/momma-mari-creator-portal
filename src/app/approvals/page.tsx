import { ApprovalsQueue } from "@/components/approvals-queue";
import { PortalFrame } from "@/components/portal-frame";
import { listApprovalQueue } from "@/lib/approvals";
import { canApproveEmail } from "@/lib/authz";
import { loadPortal } from "@/lib/current-user";
import { redirect } from "next/navigation";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; approvalError?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (!canApproveEmail(portal.viewer)) redirect("/");
  const items = await listApprovalQueue(portal.db, portal.viewedId);
  const waiting = items.filter((item) => item.status === "pending").length;
  const creatorQuery = portal.viewer.role === "admin" ? portal.viewedId : "";
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="approvals"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>Approvals</h1>
            <p>
              {waiting === 0 ? "No emails are waiting." : `${waiting} ${waiting === 1 ? "email is" : "emails are"} waiting for your OK.`}
              {" "}Nothing goes to a brand until you approve it. Mail is sent from authentickambiz@gmail.com.
            </p>
          </div>
        </div>
      }
    >
      <ApprovalsQueue items={items} creatorQuery={creatorQuery} error={params.approvalError === "1"} />
    </PortalFrame>
  );
}

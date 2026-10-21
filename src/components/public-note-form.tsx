import { PrivacyNotice } from "@/components/privacy-notice";

export function PublicNoteForm({
  action,
  messageLabel,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  messageLabel: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card stack">
      <label>Name
        <input name="name" required autoComplete="name" maxLength={120} />
      </label>
      <label>Email
        <input name="email" type="email" required autoComplete="email" maxLength={160} />
      </label>
      <label>{messageLabel}
        <textarea name="message" required rows={5} maxLength={4000} />
      </label>
      <div className="leave-blank" aria-hidden="true">
        <label>Leave this blank
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <PrivacyNotice />
      <button className="btn" type="submit">{submitLabel}</button>
    </form>
  );
}

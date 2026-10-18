type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

/** True only when the portal is explicitly switched to BoldSign. Off by default. */
export function boldSignEnabled() {
  return process.env.BOLDSIGN_ENABLED === "true";
}

/**
 * Click-to-sign stays on this site unless both the flag and an API key are set.
 * The network is not called on either of the off paths.
 */
export async function sendContractWithBoldSign(input: {
  title: string;
  signerName: string;
  signerEmail: string;
}): Promise<Result<{ message: string }>> {
  if (!boldSignEnabled()) {
    return { ok: false, status: 403, error: "BoldSign is off. Signing stays on this site, at no extra cost." };
  }
  const key = process.env.BOLDSIGN_API_KEY?.trim();
  if (!key) {
    return { ok: false, status: 400, error: "BoldSign is on, but the API key is missing. Nothing was sent." };
  }
  const response = await fetch("https://api.boldsign.com/v1/document/send", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Title: input.title,
      Signers: [{ Name: input.signerName, EmailAddress: input.signerEmail, SignerType: "Signer" }],
    }),
  });
  if (!response.ok) {
    return { ok: false, status: 502, error: "BoldSign did not accept the contract. Nothing was sent from this site." };
  }
  return { ok: true, message: "Sent through BoldSign." };
}

// Sends the site's emails (for now, only "verify your email") through Resend's HTTP API.
//
// Set RESEND_API_KEY with `wrangler secret put RESEND_API_KEY`, and EMAIL_FROM to an address on a
// domain verified in Resend, e.g. "Helix Paradox <noreply@helix.example.com>". Without a key, local
// dev prints each email (and its link) to the worker's console instead of sending it.

export interface EmailEnv {
  BETTER_AUTH_URL: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const isLocal = (env: EmailEnv) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.BETTER_AUTH_URL);

export async function sendEmail(env: EmailEnv, email: Email) {
  if (!env.RESEND_API_KEY) {
    if (!isLocal(env)) throw new Error("RESEND_API_KEY is not set, so emails can't be sent");
    console.log(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? "Helix Paradox <onboarding@resend.dev>",
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function verificationEmail(to: string, name: string, url: string): Email {
  const text = [
    `Hi ${name},`,
    "",
    "Confirm your email to finish creating your Helix Paradox account:",
    url,
    "",
    "The link works for 24 hours. If you didn't sign up, ignore this email.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>Confirm your email to finish creating your Helix Paradox account:</p>
<p><a href="${escapeHtml(url)}">Confirm my email</a></p>
<p>The link works for 24 hours. If you didn't sign up, ignore this email.</p>`;
  return { to, subject: "Confirm your email for Helix Paradox", text, html };
}

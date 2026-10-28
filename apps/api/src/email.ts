// Sends the site's emails (for now, only "verify your email") with Cloudflare Email Service,
// through the EMAIL binding in wrangler.jsonc, from EMAIL_FROM. The sender's domain must be
// onboarded in Cloudflare (Compute > Email Service > Email Sending), and sending to any address
// needs the Workers Paid plan.
//
// Local dev prints each email (and its link) to the worker's console instead of sending it, so
// testing sign-up never emails anyone.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const isLocal = (env: Env) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.BETTER_AUTH_URL);

export async function sendEmail(env: Env, email: Email) {
  if (isLocal(env)) {
    console.log(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`);
    return;
  }
  try {
    await env.EMAIL.send({
      from: { email: env.EMAIL_FROM, name: "Helix Paradox" },
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch (err) {
    // Usually a code like E_SENDER_NOT_VERIFIED. Before the domain is onboarded for Email Sending,
    // the binding acts like Email Routing and refuses any address that isn't a verified one:
    // "destination address is not a verified address".
    // Better Auth catches this and logs it rather than failing the sign-up, so the person sees
    // "check your inbox" either way; signing in later sends a fresh link.
    const { code, message } = err as { code?: string; message?: string };
    console.error(`Email to ${email.to} failed: ${code ?? message ?? err}`);
    throw err;
  }
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

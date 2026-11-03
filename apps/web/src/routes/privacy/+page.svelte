<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import LegalPage from '#lib/components/LegalPage.svelte';
	import { CONTACT_EMAIL, OPERATOR } from '#lib/legal.ts';
</script>

<Seo
	title="Privacy · Helix Paradox"
	description="What Helix Paradox stores about you, who helps run it, and how to delete your account."
/>

<LegalPage
	title="Privacy"
	intro="Helix Paradox keeps as little about you as it can: enough to run your account and the characters you share. No ads, no tracking, nothing sold."
>
	<h2>Who runs this</h2>
	<p>
		Helix Paradox is a non-commercial fan project run by {OPERATOR}, who decides what is stored and why.
		Questions, or anything on this page you want to act on:
		<a href="mailto:{CONTACT_EMAIL}" class="link">{CONTACT_EMAIL}</a>.
	</p>

	<h2>Browsing without an account</h2>
	<p>
		You can browse and copy DNA without signing up. We don’t set cookies for you and don’t keep your IP
		address. To count how many people view a character, we store a code made from your connection and
		browser that changes every day, so a visit can’t be traced back to you or linked to your visits on
		other days. We also count page visits, and which site sent visitors here, with Cloudflare Web
		Analytics, which uses no cookies and doesn’t identify or follow you.
	</p>

	<h2>What we store when you have an account</h2>
	<ul>
		<li><strong>Your account:</strong> username, email address and password. The password is stored only as a one-way hash, so nobody, us included, can read it.</li>
		<li>
			<strong>Your sign-ins:</strong> for each device you’re signed in on, the IP address and browser it
			used, so the sign-in can be checked and abuse spotted. Each is deleted when you sign out or it
			expires.
		</li>
		<li>
			<strong>What you share and do:</strong> characters (name, DNA, description, tags and pictures),
			favourites, collections, “works in my game” marks, and reports you make. Characters and collections
			you make public are public, with your username on them. Favourites, and which characters you’ve
			reported, are not shown to anyone else.
		</li>
		<li>
			<strong>Pictures:</strong> before we store a picture, we remove its metadata (camera details, time and
			GPS location), and the upload page shrinks it first anyway.
		</li>
	</ul>

	<h2>Why</h2>
	<p>
		To run the account you asked for and show what you share (the service itself), and to keep the site
		safe: limiting how fast requests can be made, stopping automated sign-ups, and dealing with reports
		(our legitimate interest in a site that works and isn’t abused). We don’t use your data for anything
		else.
	</p>

	<h2>Emails</h2>
	<p>
		Only the ones the site needs: confirming your email address when you sign up or sign in before
		confirming. No newsletters or marketing.
	</p>

	<h2>Cookies and storage</h2>
	<p>
		Signing in sets cookies that keep you signed in: a session token, and a short-lived signed copy of
		your session so pages load faster. They’re needed for the account to work, so there’s no banner
		asking. The upload page briefly keeps DNA you’re moving between pages in your browser’s session
		storage, and clears it once used. No analytics or advertising cookies.
	</p>

	<h2>Who helps run the site</h2>
	<ul>
		<li>
			<strong>Cloudflare</strong> hosts everything: the site, the database, the stored pictures, the
			emails we send, and the visit counts above. Its Turnstile check on the sign-up page looks at your browser to tell people from
			bots. Cloudflare also keeps short-lived request logs, used to find errors. See
			<a href="https://www.cloudflare.com/privacypolicy/" class="link">Cloudflare’s privacy policy</a>.
		</li>
	</ul>
	<p>Cloudflare may handle data outside your country, including in the United States.</p>

	<h2>How long we keep it</h2>
	<p>
		For as long as you have an account. When you delete your account, everything above goes at once:
		your account, characters and their pictures, favourites, collections and reports. The database keeps
		a rolling 30-day history for recovering from mistakes, so deleted data is fully gone after 30 days.
	</p>

	<h2>Your rights</h2>
	<p>
		You can see and change what you’ve shared at any time, and delete your account (with everything in
		it) from <a href="/account" class="link">your account page</a>. You can also ask us for a copy of
		your data, to correct it, or to stop using it, by emailing
		<a href="mailto:{CONTACT_EMAIL}" class="link">{CONTACT_EMAIL}</a>. If you’re in the UK or EU and
		unhappy with how we’ve handled your data, you can complain to your data protection authority.
	</p>

	<h2>Age</h2>
	<p>
		Accounts are for people aged 13 or over, or older where your country’s law sets a higher age for
		agreeing to this yourself.
	</p>

	<h2>Changes</h2>
	<p>If this page changes in a way that matters, the date at the top changes, and big changes are announced on the site.</p>
</LegalPage>

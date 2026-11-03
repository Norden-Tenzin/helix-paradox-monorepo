<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import LegalPage from '#lib/components/LegalPage.svelte';
	import { CONTACT_EMAIL, OPERATOR } from '#lib/legal.ts';
</script>

<Seo
	title="Terms and content rules · Helix Paradox"
	description="The rules for sharing characters on Helix Paradox, what's allowed, and how reports work."
/>

<LegalPage
	title="Terms and content rules"
	intro="The short version: share characters you made or are free to share, keep it clothed and kind, and the DNA you post is there for everyone to use."
>
	<h2>About the site</h2>
	<p>
		Helix Paradox is a free, non-commercial fan project run by {OPERATOR}, for sharing character DNA
		from Paradox Interactive’s games. It isn’t affiliated with or endorsed by Paradox Interactive.
		Crusader Kings and the game’s art are Paradox Interactive’s. By using the site you agree to these
		terms; if you don’t, please don’t use it.
	</p>

	<h2>Your account</h2>
	<ul>
		<li>You need to be 13 or over, or older where your country requires it.</li>
		<li>Use a real email address you can receive mail at, and keep your password to yourself. What’s done from your account is on you.</li>
		<li>One account per person. Don’t make accounts to get around a ban.</li>
	</ul>

	<h2>What you share</h2>
	<ul>
		<li>
			<strong>Only share what’s yours to share:</strong> characters you made yourself, or ones whose maker
			is happy for them to be shared. Copying someone else’s character from another site and posting it
			as yours isn’t allowed.
		</li>
		<li>
			<strong>You keep whatever rights you have</strong> in what you post. You give us permission to store
			it, show it on the site, resize and re-encode the pictures, and keep it up until you delete it.
		</li>
		<li>
			<strong>Shared DNA is for everyone to use.</strong> That’s the point of the site: anyone can copy a
			character’s DNA into their own game, change it, and play with it. Credit is kind, but we can’t
			make anyone give it.
		</li>
		<li>
			<strong>Portraits are screenshots of Paradox’s game,</strong> shared under the room Paradox gives
			players to share what they make for non-commercial purposes. That’s one reason this site will stay
			non-commercial.
		</li>
	</ul>

	<h2>Content rules</h2>
	<p>Not allowed, in pictures, names, descriptions, tags or collections:</p>
	<ul>
		<li>Nudity or sexual content of any kind.</li>
		<li>Hate, harassment or threats aimed at a person or group, and slurs.</li>
		<li>Graphic gore beyond what the game itself shows.</li>
		<li>Anyone’s personal information, such as addresses or phone numbers.</li>
		<li>Spam, advertising, links to malware or scams, and anything illegal.</li>
	</ul>
	<p>
		<strong>Real people</strong>, historical or living, are fine: kings, celebrities, yourself, your
		friends. But not sexualised, not to mock or harass someone, and not passed off as anything other
		than a game character. If you’re the person depicted and want it taken down, report it or email us
		and we will.
	</p>

	<h2>Reports and moderation</h2>
	<p>
		Anyone signed in can report a character. When three different people report one, it’s hidden until
		we review it. We can hide or delete anything that breaks these rules, and suspend or ban accounts
		that do, without warning when it’s serious. A banned account’s characters may be removed.
	</p>

	<h2>Copyright and takedowns</h2>
	<p>
		If something on the site is yours and was shared without your permission, or shows you and you want
		it gone, email <a href="mailto:{CONTACT_EMAIL}" class="link">{CONTACT_EMAIL}</a> with a link to the
		character and why. We act on requests in good faith, and quickly.
	</p>

	<h2>No guarantees</h2>
	<p>
		The site is free and provided as it is. DNA can break with game patches or mods, characters can
		disappear, and the site may change or close. As far as the law allows, we aren’t liable for losses
		from using it. Nothing here limits rights you have by law that can’t be limited.
	</p>

	<h2>Leaving</h2>
	<p>
		You can delete your account from <a href="/account" class="link">your account page</a> at any time,
		and everything you shared goes with it. See the <a href="/privacy" class="link">privacy page</a> for
		what we store and why.
	</p>

	<h2>Changes</h2>
	<p>
		If these terms change, the date at the top changes, and big changes are announced on the site.
		Using the site after a change means you accept the new terms.
	</p>
</LegalPage>

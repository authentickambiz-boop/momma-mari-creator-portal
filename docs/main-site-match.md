# Main site changes so it matches the portal

The creator portal now uses the same colors, type, and wordmark as https://mommamari.com. Do not change the portal to chase a new palette. These are the only edits to make on the Webflow marketing site.

Measured from the live site on October 19, 2026 (stylesheet `momma-mari.webflow.shared.9d28da0da.min.css`).

## Creator login on a phone

The nav already has this link, and it already points at the portal:

```html
<a href="/portal/login" class="availability-button creator-login">Creator login</a>
```

On a desktop that link is visible next to Apply Now. Inside the `@media screen and (max-width: 767px)` block, `.availability-button.creator-login` is set to `display: none`, so a phone never shows it.

Change: in that 767px block, remove `display: none` from `.availability-button.creator-login` so the phone menu shows Creator login. Leave the href as `/portal/login`. The full address is https://mommamari.com/portal/login.

## Apply as a Creator

That button is not in this repo. On the Webflow marketing site, "Apply as a Creator" (and the form on https://mommamari.com/creators) points at the old Jotform `https://form.jotform.com/262870913967067`. "Apply Now" on the homepage goes to `/creators`, which is that same Webflow page.

In the Webflow Designer, change those links to `https://mommamari.com/portal/apply`. The portal page is already the application. Do not leave the Jotform in place.

## Shared look (already on the marketing site)

No other Webflow color or font change is required. The portal was brought to these existing tokens:

- Page canvas on forms: `#fffded`
- Header and body black: `#1f1f1f`
- Forest buttons: `#265941`, white label, 10px radius, padding 12px 28px. Hover flips to ivory `#faf6e8` with forest text.
- Secondary buttons: forest text on `#fffded`, same radius. Hover fills forest with white text.
- Sand `#c7b198` for the pilot notice. Gold `#d4af37` stays off buttons, because white type on gold fails contrast.
- Cards: white, 14px radius, shadow `0 3px 14px 3px #c7b19840`
- Headings: Impact, Haettenschweiler, Franklin Gothic Bold, Charcoal, sans-serif
- Body: Verdana, Geneva, sans-serif
- Wordmark: the existing Momma Mari logo. On the portal's black header it is inverted so it reads white. On the cream login card it stays black.

Space Grotesk is loaded on the marketing site and unused in the CSS. Leave it alone.

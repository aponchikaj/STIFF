# HTML autocomplete Attributes by Form Type

Correct `autocomplete` values let the browser or password manager fill entire form sections in one tap. Pair each with the right `type` and `inputmode` so mobile users also get the correct keyboard. Rules that apply everywhere:

- Never use `autocomplete="off"` to "improve security" — browsers largely ignore it on login/payment fields, and it breaks password managers for everyone else.
- Prefer `type="text"` + `inputmode="numeric"` over `type="number"` for digit strings (card numbers, ZIP, OTP): `type="number"` strips leading zeros, adds spinners, and allows `e`/`-`.
- Section prefixes: `shipping` and `billing` tokens (e.g. `autocomplete="shipping postal-code"`) let one page hold two address blocks that autofill independently. Arbitrary groups use `section-*` (e.g. `section-passenger1 name`).

## Identity

| Field | autocomplete | type | inputmode | Notes |
|---|---|---|---|---|
| Full name | `name` | `text` | — | Prefer one full-name field; name-splitting fails for many cultures |
| First name | `given-name` | `text` | — | Only if the backend truly requires split names |
| Last name | `family-name` | `text` | — | |
| Middle name | `additional-name` | `text` | — | |
| Honorific | `honorific-prefix` | `text` | — | Mr/Ms/Dr |
| Email | `email` | `email` | — | `type="email"` summons the @ keyboard |
| Phone | `tel` | `tel` | — | `type="tel"` summons the dial pad |
| Phone country code | `tel-country-code` | `text` | — | Usually a `<select>` |
| Phone without country code | `tel-national` | `tel` | — | |
| Birthday (full) | `bday` | `date` | — | |
| Birthday parts | `bday-day` / `bday-month` / `bday-year` | `text` | `numeric` | |
| Sex/gender | `sex` | `text` | — | Free text per spec; consider whether you need it at all |
| Organization | `organization` | `text` | — | Company name |
| Job title | `organization-title` | `text` | — | |
| Personal URL | `url` | `url` | — | `type="url"` summons the / and .com keyboard |
| Profile photo | `photo` | `url` | — | |
| One-time code (SMS/TOTP) | `one-time-code` | `text` | `numeric` | Enables iOS/Android SMS code auto-suggest |

## Address

Use with `shipping` / `billing` prefixes when both blocks appear: `autocomplete="shipping street-address"`.

| Field | autocomplete | type | inputmode | Notes |
|---|---|---|---|---|
| Full address (single textarea) | `street-address` | `textarea` | — | Use when one field holds the whole street address |
| Address line 1 | `address-line1` | `text` | — | |
| Address line 2 | `address-line2` | `text` | — | Mark "(optional)"; apt/suite |
| Address line 3 | `address-line3` | `text` | — | Rarely needed |
| City | `address-level2` | `text` | — | |
| State/province | `address-level1` | `text` | — | `<select>` for known-country forms |
| Postal/ZIP code | `postal-code` | `text` | `numeric` for US-only; omit for international | UK/Canada/NL postcodes contain letters — only force numeric when the form is strictly US |
| Country | `country-name` | `text` | — | Human-readable name; usually a `<select>` |
| Country code | `country` | `text` | — | ISO 3166 code (e.g. `US`); use on the `<select>` whose values are codes |

Tip: pair these with an address-autocomplete service (Google Places or similar) — the `autocomplete` attributes then act as the fallback path and the target fields for the picker to populate.

## Payment

The `cc-*` family is what lets a saved card fill in one tap. Missing these is the most expensive autofill omission in checkout.

| Field | autocomplete | type | inputmode | Notes |
|---|---|---|---|---|
| Name on card | `cc-name` | `text` | — | Single field; split `cc-given-name`/`cc-family-name` exist but are rarely needed |
| Card number | `cc-number` | `text` | `numeric` | Never `type="number"`; accept and strip spaces/dashes on paste |
| Expiry (combined MM/YY) | `cc-exp` | `text` | `numeric` | Preferred over split fields — matches embossed format |
| Expiry month | `cc-exp-month` | `text` | `numeric` | Only if backend demands split |
| Expiry year | `cc-exp-year` | `text` | `numeric` | |
| Security code (CVC/CVV) | `cc-csc` | `text` | `numeric` | Width ~4ch; browsers deliberately do not store this — expect manual entry |
| Card type | `cc-type` | `text` | — | Prefer detecting from the number's first digits instead of asking |
| Transaction amount | `transaction-amount` | `text` | `decimal` | Donation/custom-amount fields |
| Transaction currency | `transaction-currency` | `text` | — | ISO 4217 code |

Note: if payment fields live inside a PSP iframe (Stripe Elements, Braintree Hosted Fields), the PSP sets these attributes — verify rather than duplicate.

## Credentials

Correct values here drive password-manager save/fill prompts and Apple/Chrome strong-password generation.

| Field | autocomplete | type | inputmode | Notes |
|---|---|---|---|---|
| Username / login email | `username` | `text` or `email` | — | Include a (possibly hidden) `username` field on password-change forms so managers update the right account |
| Password (login) | `current-password` | `password` | — | Triggers fill from the manager |
| Password (signup / new) | `new-password` | `password` | — | Triggers strong-password generation and prevents the manager filling the old password |
| Confirm new password | `new-password` | `password` | — | Same token as the new-password field; consider dropping confirm entirely in favor of a show-password toggle |
| One-time code | `one-time-code` | `text` | `numeric` | SMS/email/TOTP verification codes |

Signup vs login distinction matters: using `current-password` on a signup form suppresses strong-password suggestions; using `new-password` on login breaks autofill. Get the token right per form, not per field name.

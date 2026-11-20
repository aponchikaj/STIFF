# What We Need: licences, banks, tax and legal for the money version of the game

Written 2026-11-20 for STIFF. Goes with [`VERSION-2-PLANNING.md`](VERSION-2-PLANNING.md).
Full sources: [`reports/Real money game Georgia.md`](reports/Real%20money%20game%20Georgia.md) and
`research_notes/Real money game Georgia/`.

> **This is research, not legal or tax advice.** Article numbers come from
> Matsne texts, sometimes older consolidated versions read through translation.
> Every item marked **LAWYER** or **ACCOUNTANT** must be confirmed by a
> Georgian lawyer or accountant before money moves. The purpose of this file is
> to make that meeting short and cheap: bring it, and go down the list.

---

## 1. The bottom line

**You can probably launch this without a gambling licence and without an NBG
licence, if the game is designed a particular way.** The design is the licence.
Get it wrong in one place (paid entry, random rewards, cash-out of bought
coins) and you fall into regimes that cost tens of thousands to millions of
lari, or are impossible for a fashion brand to get.

The safe design, in five rules:

1. **Free to enter, free to play.** No entry fee, and nothing bought with money
   that helps anyone earn lari.
2. **A fixed price per task, decided by skill and effort.** No draws, no random
   rewards, no "mystery" prize amounts.
3. **STIFF pays from its own money.** Users never top up a balance. Money is
   never transferred between users, and the balance can't be spent anywhere
   except by withdrawing it.
4. **18+ for money.** 16 and 17 year olds play for coins only.
5. **STIFF withholds and pays the 20% income tax** on every payout.

If those five hold, what you need is: **a lawyer's written opinion, a business
bank account with an API, terms and privacy documents, a tax setup, and KYC.**
You do not need a casino licence, an NBG payment-provider licence or an AML
registration.

---

## 2. Is this gambling? (Law on Organizing Lotteries, Games of Chance and Other Prize Games)

**Law No. 1180/2005**, Matsne doc 30988 (consolidated to 28/10/2026).

| Question | Answer | Status |
|---|---|---|
| What makes something gambling or a lottery? | An **element of chance** plus a prize (Art. 3(ა) games of chance, 3(თ) lottery, 3(ო) prize games) | Law |
| Is a skill game covered? | **No.** Art. 4 excludes games decided by skill, knowledge or dexterity with no element of chance | Law |
| Is our game a skill game? | **Probably yes:** fixed GEL per task, the outcome depends on doing the task, no draw, no stake, no prize fund | **LAWYER** |
| What if we draw prizes at random (for example "spin for a bonus" or a raffle among finalists)? | That becomes a **promotional prize game** (Art. 3(ო.დ)): a 1-year permit from the Revenue Service (Art. 18(ბ)), reportedly **GEL 15,000**, draw rules, a draw committee, results reported within 2 days (Arts. 12, 13, 16). It **must be free to enter**; any fee is prohibited | Law (fee unverified) |
| What if users pay (coins or opals bought with lari) and it affects cash rewards? | Then it's **gambling or a lottery**: 25+ for Georgian citizens (Art. 32(1)), an advertising ban, permit fees in the **millions of GEL**, impossible for STIFF | Law |
| Running an unauthorised lottery | **GEL 50,000** fine, then **GEL 150,000** for each repeat (Art. 37²) | Law |
| Lottery prizes to under-18s | Prohibited (Art. 32(2)) | Law |

**What this means for the design (already in the plan):**
- Opals (bought for lari) **must not** buy hearts, time, rerolls, skips or
  anything else that raises lari earnings in a money season. Best: turn opal
  sales off in money seasons, or limit them to cosmetics.
- Watchers earn **coins, not lari**, and get a fixed amount per correct vote.
  A pool shared among voters who "called it right" looks like a
  **totalizator** (a bet on an event).
- The **season finale** prize must be a **fixed, announced prize won on
  performance**, not a draw. A raffle among finalists needs the
  promotional-game permit above.
- The AI resolver choosing a vote payout of "2–5 coins" is fine for coins, but
  **never apply variable, model-chosen amounts to lari.**

---

## 3. Do we need an NBG licence? (payments and e-money)

**Law of Georgia on Payment Systems and Payment Services** (Matsne 1673253) and
NBG orders.

| Question | Answer | Status |
|---|---|---|
| Who may provide payment services? | Only banks, microfinance organisations and **NBG-registered payment service providers** (Art. 15) | Law |
| What is e-money? | Funds **received from users** and accepted by someone other than the issuer (Art. 2). Customer funds go in segregated nominal accounts (Art. 18, amended 15 October 2026 by No. 1890) | Law (current text, but the Dec 2025 amendment, Law 1303, was not read) |
| Exemptions | Art. 13(2): only instruments usable on the issuer's own premises. **No "limited network" or loyalty exemption** like the EU's PSD2 Art. 3(k), but Art. 13(3) lets the NBG add exclusions | Law |
| Is our wallet e-money? | **Arguably not**, if users never put money in, the balance can't be transferred, and only STIFF pays it out. In that case it's STIFF's debt to the user for work done, not stored value | **LAWYER**, the most important question in this file |
| What makes it riskier? | Users topping up; bought coins that can be cashed out; user-to-user transfers; spending the balance at third parties | Interpretation |
| If we do need to register as a PSP | The law itself sets no capital figure. Secondary sources conflict: no minimum capital vs **GEL 50,000–350,000**, and a registration fee of **GEL 5,000 vs 10,000** | Sources conflict, **LAWYER** |
| A licensed partner to hold the balances? | **None found** in Georgia offering a white-label wallet | Research gap |
| Open banking (payment initiation)? | Exists (BoG `xs2a.bog.ge`), but needs NBG approval as a payment initiation provider or a licensed partner plus a QWAC certificate. **Not needed** to pay out of our own account | Research |

**Recommendation:** structure the wallet as **"rewards STIFF owes you, paid
from STIFF's own account"**. That is the design in the plan: no top-ups, no
transfers, withdraw-only. Ask the lawyer to confirm in writing that this is not
e-money and not a payment service.

---

## 4. AML/CFT (Law on Facilitating the Prevention of Money Laundering, 2019)

| Question | Answer | Status |
|---|---|---|
| Who are "obliged entities"? | Among others: **organisers of lotteries, gambling and prize games**, and **payment service providers** | Law |
| Is STIFF one? | **Likely no**, as long as we have no prize-game permit and no PSP registration | **LAWYER** |
| What if we become one? | Identification at reportedly **GEL 5,000** per transaction (the gambling rule); threshold reports above **GEL 50,000** within 5 working days; registration with the Financial Monitoring Service (fms.gov.ge) and an AML officer | Secondary sources |

**Even if the law doesn't require it, do KYC at the first withdrawal anyway.**
The bank won't KYC our recipients for us: banks verify STIFF, not the people
STIFF pays. We need ID numbers for the tax notice (§6), and fraud (multiple
accounts, money mules) is the biggest money risk in the game. Minimum:
- legal name and **personal ID number**, date of birth;
- an ID photo and a selfie (a KYC vendor such as Sumsub or Veriff; we keep only the result, not the images);
- the **IBAN or card must be in the same name** (for BoG accounts, BoG's API
  can match the ID number to the account: `CheckInn`);
- **one wallet per personal ID number.**

---

## 5. Minors (Civil Code, Matsne 31702)

| Question | Answer | Status |
|---|---|---|
| Age of majority | **18** (Art. 12(2)) | Law |
| 7 to 18 | **Limited capacity** (Art. 14(1)) | Law |
| Can a 16 or 17 year old accept our terms alone? | **No.** A minor's transaction needs a parent's consent unless it only benefits the minor (Arts. 15, 63, 66). Terms with obligations, filming and content licences are not "only a benefit" | Law plus interpretation |
| Data consent | Possible from **16**; special-category data such as biometrics needs written parental consent (Personal Data Protection Law, Art. 7) | Law |
| Ads showing minors in danger | Prohibited (Law on Advertising, Art. 14(c)) | Law |

**Decision: the money version is 18+.** The current game is 16+, so under-18
accounts stay on coins only, are never shown a lari price, and can't open a
wallet. Keeping 16 and 17 year olds in money mode would need verified parental
consent, payouts to a parent's card and a restricted task pool, which is
expensive and a reputational trap. Not recommended.

---

## 6. Tax (Tax Code of Georgia; 2023 English text read, re-check against the 28/10/2026 version)

| Item | Rule | Status |
|---|---|---|
| Personal income tax | **20%** (Art. 81(1)) | Law |
| Who pays | **STIFF withholds at source**, either as payment for services to a non-entrepreneur individual (Art. 154(1)(d)) or as a promotional-game prize (Art. 154(1)(e)) | Law, **ACCOUNTANT** to pick the framing |
| When | The tax is transferred **when paid** (Art. 154(3)(a)). A monthly notice on rs.ge by the **15th of the next month**, listing each person's **ID number, name, address, income, tax** (Art. 154(3)(c)), plus a disbursement return (Art. 154(4)) | Law |
| Any exemption? | **None fits.** GEL 1,000 gift exemption only for gifts *from a natural person* (Art. 82(1)(h)); the lottery exemption needs a lottery (Art. 82(1)(w)) | Law |
| The "free transfer under GEL 1,000 per year" route | No withholding (Art. 154(1)(l)), **but** STIFF then owes **15% profit tax grossed up (about 17.65%)** under Art. 97(1)(c), and it's legally weaker | **ACCOUNTANT** |
| Profit tax on payouts as a business expense | If framed as **payment for content or services** (players license their videos to STIFF), it's a business expense and not distributed profit | **ACCOUNTANT** |
| VAT | Cash isn't goods (Art. 160(2)), so no VAT on lari rewards. **Coin-shop merchandise** given away may be a taxable free supply (Art. 160(3)(a)) | Law |
| Reverse-charge VAT | On foreign SaaS (Supabase, Fly.io, Cloudflare, Anthropic) (Art. 161), which we likely already deal with | Law |
| Non-resident players | Only taxable in Georgia for services performed in Georgia (Art. 104(1)(c.a)); otherwise 10% or 15% | Law |
| Pension contributions on service payments | **Unknown, ask** | Gap |

### What the tax costs (STIFF pays it on top, "the price you see is what you get")

| Price shown to player (net) | Gross | Tax STIFF pays to rs.ge | Total cost to STIFF |
|---|---|---|---|
| 0.50 ₾ | 0.625 ₾ | 0.125 ₾ | 0.625 ₾ |
| 1.00 ₾ | 1.25 ₾ | 0.25 ₾ | 1.25 ₾ |
| 5.00 ₾ | 6.25 ₾ | 1.25 ₾ | 6.25 ₾ |
| 100.00 ₾ | 125.00 ₾ | 25.00 ₾ | 125.00 ₾ |

Gross = net ÷ 0.8 (adding 20% under-withholds). **Budget every season at
1.25 times the announced prize money**, plus transfer fees.

The alternative is to show gross prices and withhold 20% (0.50 ₾ pays 0.40 ₾).
That's cheaper, but "50 tetri" stops being true. Not recommended for a game
whose whole hook is the number on the card.

**Practical: tax is calculated per payout, not per withdrawal.** The ledger
already records every task reward, so the monthly rs.ge notice is one query,
grouped by personal ID number. That is why KYC must capture the ID number.

---

## 7. Banks and payout providers: who can actually send the money

| Provider | Pays out to | How | Status |
|---|---|---|---|
| **Bank of Georgia: Business Online (Bonline) API** | **Any Georgian IBAN**, other banks included | `POST api/documents/bulk/domestic`, an array of payments; OAuth2; `CheckUniqueId` gives idempotency (rejects a repeated `UniqueId` within 7 days); the `BULK` type is capped at **10,000 ₾ per transaction**; optional `IsSalary` flag. Docs: https://api.bog.ge/docs/en/bonline/documents/bulk-domestic | **Works. Recommended first** |
| **TBC Bank: BIS Transfers API** | Any Georgian IBAN | `/bab/v1/transfers/single` and `/batch` (OAuth2); legacy import takes 1 to 1,000 orders per batch. Docs: https://developers.tbcbank.ge/docs/bis-transfers | **Works.** Equal alternative |
| **Flitt** (TBC group, formerly Fondy) | **Cards** | `POST /api/p2pcredit`, separate payout key. Needs a **card token from an earlier payment** by that user (`required_rectoken=Y`), and STIFF needs a **TBC account**. Fees not published. Docs: https://docs.flitt.com/api/create-order-p2pcredit/ | **Works, phase 2** |
| BoG / TBC card acquiring (the e-commerce APIs) | — | No payout endpoint in the public docs; BoG iPay deprecated | No |
| Payze | — | Says it no longer operates in Georgia; card payouts are Uzbekistan-only | **No** |
| UniPay | — | **No public merchant payout API found.** Ask them directly | Unconfirmed |
| Keepz | Instant transfers | NBG-registered, open banking approved; 0.50 ₾ intro price, up to 100,000 ₾ a day; but connected to Silk, Tera, Pasha, Credo and Basis, **not BoG or TBC**, and not documented as a merchant payout API | Not suitable now |
| Liberty Bank, eMoney Georgia, TBC Pay | — | No public merchant payout API found | Unconfirmed |

Banks **create** the payment orders through the API, but they still have to be
**signed** inside the bank's online banking under the account's signing rules.
That gives us the right workflow for free: **code prepares the batch, a person
with signing rights approves it in the bank.** That is four-eyes control on
money, which is exactly what we want for launch.

### Fees we know and don't know

| Fee | Value |
|---|---|
| NBG interbank clearing, bulk, 09:00–17:45 | 0.20 ₾ (central bank fee, not the bank's own) |
| BoG/TBC business transfer tariffs | **Not published. Get a quote** |
| Flitt payout fee and limits | **Not published. Get a quote** |
| Keepz | 0.50 ₾ intro |

A fee of 0.20–0.50 ₾ per transfer eats a 0.50 ₾ reward whole. That is why the
plan has a **minimum withdrawal (5 ₾ default)** and **weekly batches.**

### The recommended setup

1. **Launch:** BoG Bonline (or TBC BIS) **bulk IBAN transfers**, built weekly
   by the backend, signed by a STIFF signatory in the bank. Status polling marks
   each withdrawal `paid_out`.
2. **Phase 2:** Flitt card payouts for convenience. Users who already bought
   from the shop or opals by card have a token; others add a card with a small
   verification payment (ask Flitt if a zero-amount or refundable verification
   is supported).
3. **Before signing with anyone, ask each bank:** their tariffs for bulk
   domestic transfers, the API batch size limit, whether an LLC needs
   anything beyond a business account to use the Bonline/BIS API, and whether
   they object to the use case (paying many individuals small amounts; tell them
   upfront, or the account may be frozen by their compliance team).

---

## 8. Personal data (Law No. 3144 on Personal Data Protection, in force 1 March 2024)

We collect videos and photos (often of bystanders), dates of birth, and at
withdrawal ID data and biometrics (selfies), plus bank details. This is heavy.

| Obligation | Rule |
|---|---|
| Lawful basis per purpose | Ten bases (Art. 5): contract for gameplay and payouts, legal obligation for tax and KYC records, consent for marketing |
| Biometric data (selfie matching) | **Special category** (Arts. 3, 6, 9). Use a KYC vendor; keep the result, not the face |
| Consent age | **16**; under 16 needs a parent (Art. 7) |
| Data Protection Officer | **Mandatory** for large-scale processing or systematic monitoring of behaviour (Art. 33). A game that films people doing tasks and scores them likely qualifies. Report the appointment to the Personal Data Protection Service within 10 working days |
| Impact assessment (DPIA) | Required for high-risk processing (Art. 31): **do one** before money mode |
| Records of processing | Required (Art. 28) |
| Processor contracts | Required (Art. 36): Supabase, Fly.io, Cloudflare, Anthropic, the KYC vendor, the bank |
| Transfers abroad | Our data is hosted outside Georgia. Allowed to adequate countries or on a listed ground; **contract-based transfers need a permit from the Service** (Arts. 37–38) | **LAWYER** |
| Breach notification | To the Service **within 72 hours** (Art. 29) |
| Data subject requests | Answer within **10 working days** |
| Fines | About GEL 1,000–10,000 per violation, capped at 10,000–20,000 per proceeding (Art. 64) |
| EU players | GDPR also applies if we target people in the EU (Art. 3(2) GDPR) |

---

## 9. Advertising (Law on Advertising)

- Ads must be recognisable as ads (Art. 4(1)). Sponsored dares carry a
  visible "sponsored" mark.
- Ads must not **urge dangerous actions** harmful to health or safety
  (Art. 4(11)). This applies directly to how we market dares: never market the
  danger, market the creativity and the money.
- Using someone's image needs consent (Art. 4(9)). **Bystanders in published
  hand-ins** need consent or blurring before a video is used in marketing.
- Minors must not be shown in dangerous circumstances (Art. 14(c)).
- The advertiser is liable for content (Art. 20).
- An amendment dated 25/06/2026 (No. 1826) has not been read. **LAWYER**

---

## 10. Consumer protection, liability, insurance

### Consumer protection (Law on the Protection of Consumer Rights, adopted 29 March 2022, in force 1 June 2022; enforcement chapter from 1 November 2022)

| Rule | What it means for us |
|---|---|
| Pre-contract information **must be in Georgian** (Art. 5(1)) | Terms, reward rules and the payout policy in Georgian first, English second |
| Distance contracts (Arts. 10–15); services of GEL 30 or less are exempt from the extra information duties (Art. 10(3)) | Opal packs and shop items of 30 ₾ or more need full distance-contract information |
| Unfair terms are judged against good faith (Art. 22(1)). **Void**: excluding liability for death or serious harm caused by gross negligence (Art. 22(3)(a)); restricting remedies or forcing arbitration (Art. 22(3)(s)) | **A liability waiver in the terms will not protect STIFF** from serious-harm claims. Safety design is the real protection |
| Enforced by the Competition and Consumer Protection Agency, which can prohibit unfair standard terms (Art. 29(4)). Fines up to **2% of annual turnover** (minimum 600 ₾) for ignoring its decisions (Art. 34) | Have the terms reviewed once by a lawyer |
| Whether a free-to-play player who earns rewards is a "consumer" | Open question, **LAWYER**. Treat players as consumers anyway |

### Liability for harm during dares
- **Civil:** liability is fault-based (Civil Code Art. 395(1)); the tort base is
  Arts. 992–993. If a STIFF task leads someone to get hurt, or to hurt a third
  party, STIFF can be sued. As above, the terms cannot waive gross negligence.
  (Verbatim tort text not retrieved, **LAWYER**.)
- **Criminal:** no Georgian law specific to "challenges". In the 2017 "Blue
  Whale" panic, police used **Criminal Code Art. 115** (bringing a person to
  suicide) and Art. 285. That shows prosecutors will reach for general
  articles if a dare platform causes harm.
- **Children's rights:** the Code on the Rights of the Child (child = under 18,
  Art. 3(a)) bans giving children harmful information or games with harmful
  content (Arts. 40(1), 66(4)). ComCom rules require an **age tag on the
  website** (fine under Administrative Offences Code Art. 144¹¹). One more
  reason the money version is 18+, and the site carries a 16+ / 18+ label.
- **What protects us:** the 25-category blocklist, a price that never rises
  with danger, human approval of every task, the "this feels unsafe" button
  that voids a task without costing a heart, quitting at any time, and records
  showing all of it. Plus a separate LLC and insurance.

### Insurance
- **Ardi** sells public liability insurance for places of mass gathering and
  event-cancellation cover. **GPI** sells the civil liability policy that a
  27 March 2019 government decree makes mandatory for mass-gathering venues.
  This covers the **finale event**.
- **Nobody publicly sells cover for participants in an online game.** Ask a
  broker for a bespoke public liability policy for the game operator (Aldagi,
  GPI, Imedi L, Ardi).

---

## 11. App stores (if we ever ship a native app)

- **Apple:** 5.3 (contests must be sponsored by the developer, with official
  rules in the app; real-money gaming needs licensing; no in-app purchase of
  credit for real-money games) and **1.4.5 (no apps that urge challenges risking
  physical harm)**.
- **Google Play:** no staking money, or items bought with money, for real-world
  prizes without a licence. Gamified loyalty must use a fixed earn-and-redeem
  ratio, not one based on performance or chance.
- **Recommendation: keep the money side on the web (stiff.ge game site).**
  A native app, if one comes later, shows coins only.

---

## 12. The checklist

### Legal (before any code that pays money)
- [ ] Hire a Georgian lawyer with gambling or fintech experience (law firms named in the research: BLC, Dentons Georgia, BGI Legal, MKD Law, Nodia Urumashvili)
- [ ] Written opinion: **not a game of chance / lottery / prize game** under Law 1180/2005, given our design (§2)
- [ ] Written opinion: **the wallet is not e-money and not a payment service** (§3)
- [ ] Confirm STIFF is **not an AML obliged entity** (§4)
- [ ] Decide: **separate LLC for the game** (ring-fences dare liability from the clothing business; costs a second set of accounts and data compliance). Recommended.
- [ ] Terms of service (ka + en), prize/reward rules, payout policy, privacy policy, cookie notice, content licence (players license their hand-ins to STIFF)
- [ ] Bystander consent and blurring policy for published media
- [ ] Insurance (public liability, and participant accident cover for the finale event)

### Tax and accounting
- [ ] Accountant: the framing (service payment vs promotional prize), confirm 20% withholding, gross-up, pension contributions
- [ ] Monthly rs.ge withholding notice process from the ledger export
- [ ] Budget: prize money × 1.25 plus fees

### Banking
- [ ] Business account (BoG or TBC; the TBC account also unlocks Flitt later)
- [ ] Apply for **Bonline API** or **TBC BIS API** access; tell the bank the use case
- [ ] Set up signing rights: who signs the weekly payout batch
- [ ] Quotes: bulk transfer tariffs, batch limits
- [ ] (Phase 2) Flitt merchant account with payout (p2pcredit) enabled

### Data protection
- [ ] Appoint a DPO and notify the Personal Data Protection Service
- [ ] DPIA for the money version
- [ ] Records of processing; processor agreements with every vendor
- [ ] Cross-border transfer basis (and permit if needed)
- [ ] KYC vendor chosen (stores the documents, not us)
- [ ] Breach response plan (72 h)

### Product rules that keep us legal (already in `VERSION-2-PLANNING.md`)
- [ ] Money mode is 18+
- [ ] Free entry; opals can't affect lari earnings
- [ ] Fixed prices; no random lari
- [ ] Watchers earn coins only
- [ ] STIFF-funded (or sponsor-funded) only; no top-ups, no transfers
- [ ] KYC and name match at first withdrawal; one wallet per ID number
- [ ] Blocklist stays absolute; price never rises with danger; safety button

### Questions to take to the meetings
**Lawyer:** §2 classification; §3 e-money; §4 AML; §5 minors (confirm 18+);
§8 cross-border transfers; §9 the 2026 advertising amendment; liability
waiver validity; whether players are contractors (employment risk).
**Accountant:** §6 framing, gross-up, pension, profit tax treatment, VAT on
merchandise prizes.
**Banks:** §7 tariffs, API access, batch limits, compliance comfort with the use
case.

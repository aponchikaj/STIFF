# Payout providers in Georgia for STIFF game withdrawals (as of November 2026)

Scope: who can push GEL from STIFF LLC to many individual users' Georgian cards or IBANs, and how. Research date 2026-11-20. Roughly 20 searches and fetches. No fees were guessed. Wherever a fee, limit or licensing point could not be confirmed from a primary source, it is listed under Gaps.

## 1. Which providers offer payouts to third-party cards or IBANs via API?

### Takeaway
Two working, documented paths exist today. (a) **Bank-to-IBAN transfers from STIFF's own business account through the bank's corporate API**: BoG Business Online API bulk "package" transfers, and TBC BIS Transfers batch API. These pay any Georgian bank's IBAN. (b) **Card payouts through Flitt (TBC group)**: its `p2pcredit` API pushes money to a card token captured earlier. The public sources found do not show a BoG or TBC acquiring-side "payout to card" API. Payze has left Georgia.

### Cited Findings

**Bank of Georgia (BoG)**
- BoG's developer portal lists these products: Payment Manager (online payments), Link Payment, Billing, Online Installment, Open Banking/Open Finance (AIS, PIS, XAIS, XPIS), Business Internet Banking (Bonline), and iPay, which is marked **Deprecated**. None is named as a payout, card-credit or disbursement product. — [BoG API docs index](https://api.bog.ge/docs/en/)
- The Bonline API has a **bulk domestic ("package") transfer**: `POST api/documents/bulk/domestic?fileName={fileName}`, JSON or XML, with an array of payments. Each payment has: `BeneficiaryAccountNumber` (IBAN, required; "Only IBAN format is allowed"), `BeneficiaryName`, `BeneficiaryInn` (personal ID, max 11 characters), `Amount`, `Nomination`, `ValueDate`, `UniqueId` (GUID), `SourceAccountNumber`, and an optional `IsSalary` flag. The response is a package ID in Business Online. — [BoG bulk-domestic](https://api.bog.ge/docs/en/bonline/documents/bulk-domestic)
- Payments to **other banks are allowed**: you pass the beneficiary bank's RTGS code in `BeneficiaryBankCode`, and `CheckInn` must be FALSE for other banks. `DispatchType` BULK "is allowed only for up to 10 000 GEL transactions"; larger amounts use MT103. With `CheckUniqueId=true`, a duplicate `UniqueId` from the last 7 days is blocked (code 702), which gives idempotency. — [BoG bulk-domestic](https://api.bog.ge/docs/en/bonline/documents/bulk-domestic)
- The Bonline API uses HTTPS and OAuth 2.0, with synchronous calls. — [BoG Bonline intro, via search summary](https://api.bog.ge/docs/en/bonline/introduction)
- A third-party gateway aggregator says BOG and Liberty Card are the only two providers whose APIs support card-to-card and P2P credit operations. BoG's public docs do not confirm this. — [Quickpay.ge comparison, updated 2026-08-07](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)

**TBC Bank**
- **BIS - Transfers API**: `POST /bab/v1/transfers/single`, `POST /bab/v1/transfers/batch`, and status endpoints for each. Authentication is an OAuth 2.0 Bearer token. It requires the "Initiate Transactions" permission. "Final execution depends on the authorization, signing, and confirmation rules" in Business Internet Banking. — [TBC BIS Transfers](https://developers.tbcbank.ge/docs/bis-transfers)
- The older SOAP **Integration Service (DBI)** can import 1 to 1000 single payment orders per batch request. Sandbox is `https://test-api.tbcbank.ge`, production is `https://api.tbcbank.ge`. — [TBC Import Batch Payments](https://developers.tbcbank.ge/docs/import-batch-payments); [DBI overview](https://developers.tbcbank.ge/docs/dbi-overview)
- A community .NET client says the Integration Service needs a .pfx certificate, username, password and certificate password. This is a secondary source. — [NuGet AppifySheets.TBC.IntegrationService.Client](https://www.nuget.org/packages/AppifySheets.TBC.IntegrationService.Client)
- TBC's e-commerce (Checkout / tpay) API covers acceptance only: create, check and cancel payments, saved-card charges, and split payments. The public docs found have no payout endpoint. — [TBC Checkout API](https://developers.tbcbank.ge/docs/checkout-api-overview); [TBC e-commerce page](https://tbcbank.ge/en/business/card-payments/e-commerce)
- TBC partnered with Visa to launch Visa Direct in Georgia and introduced Visa+ (send to a TBC card by mobile number). The only limit found was "1,000 units per transaction", and it is a consumer remittance product, not a merchant payout API. — [cbw.ge](https://cbw.ge/banking/visa-partners-with-tbc-to-launch-visa-direct-in-georgia); [Visa press release](https://ge.review.visa.com/en_GE/about-visa/newsroom/press-releases/prl-12022025.html)

**Flitt (TBC Bank Group, formerly Fondy Georgia)**
- The Flitt Payouts product page describes "instant withdrawals to users", "online balance withdrawals", transfers to "a bank card or bank account", and single or bulk payouts from one dashboard. It gives no fees, limits, timings or supported card networks. — [flitt.com/payouts](https://flitt.com/payouts/)
- API: `POST /api/p2pcredit` with `tran_type: "p2p credit"`, currency GEL/USD/EUR/UZS, and amount in minor units. It requires `receiver_rectoken` (a Flitt token) or `external_rectoken` (a UFC token), **not a raw card number**. The token comes from an earlier purchase made with `required_rectoken=Y`. Requests are signed with a separate **credit (payout) key**. — [Flitt p2pcredit docs](https://docs.flitt.com/api/create-order-p2pcredit/)
- Onboarding: the merchant must be legally registered in Georgia, Uzbekistan, Armenia or Moldova, and must have **an active TBC Bank account**. — [flitt.com/payouts FAQ](https://flitt.com/payouts/)
- Flitt's published acceptance rates are 2.0 to 2.2% domestic and about 2.5% international (aggregator's figures). No payout fee was published. — [Quickpay.ge](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)

**Payze**
- Payze's own pricing and FAQ pages say it is **no longer operating in Georgia** and is not onboarding new clients globally. Wix removed it in July 2024. Its Account-to-Card (A2C) payout product is limited to Uzbekistan (Uzcard and Humo). — [Payze pricing](https://payze.io/en/pricing); [Payze FAQ](https://payze.io/en/faq); [Payze A2C docs](https://docs.payze.io/docs/account-to-card-a2c); [Wix](https://support.wix.com/en/article/connecting-payze-as-a-payment-provider)

**Keepz**
- Registered with NBG as "Keepz Payment System" (0099-7704). The NBG also lists LLC "Keepz.me" as a payment system operator. — [NBG PSP register](https://nbg.gov.ge/en/payment-system/providers); [NBG PSO list](https://nbg.gov.ge/en/page/payment-system-operators-group-3)
- It was the first non-bank to join Georgian open banking. — [NBG news](https://nbg.gov.ge/en/media/news/varlam-ebanoidze-keepz-s-strides-in-open-banking-to-spur-growth-in-georgian-fintech)
- In October 2025 it launched a 24/7 instant bank-to-bank transfer service for banks (Silk, Tera, Pasha, Credo, Basis). It has a limit of up to 100,000 GEL per day and an introductory price of 0.50 GEL per transfer. It is a bank-integrated service, not documented as a merchant payout API. BoG and TBC are not listed. — [FinChannel](https://finchannel.com/keepz-brings-georgia-its-first-24-7-instant-bank-to-bank-transfer-service/127998/georgian-local-news/2025/10/)
- Acquiring is via Credo Bank, with split settlements. Fees are not published. — [Quickpay.ge](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)

**UniPay**
- Registered PSP "UNIPAY" (0007-9004). — [NBG PSP register](https://nbg.gov.ge/en/payment-system/providers)
- It runs a consumer wallet (withdraw to a bank account, link Visa or Mastercard), merchant acceptance via Liberty Bank acquiring (quote-based), and inbound IBAN payouts from the UK and EU via TransferGo. No public merchant payout API was found. — [UniPAY wallet app](https://apps.apple.com/us/app/unipay-wallet/id1180567676); [The Paypers](https://thepaypers.com/payments-general/unipay-partners-with-transfergo--1270387); [Quickpay.ge](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)

**Liberty Bank**
- Liberty's e-commerce page describes standard and recurring card charging. Its gateway (TXPG) is quote-based. An aggregator claims it supports card-to-card and P2P credit; the bank's public pages do not confirm this. — [Liberty e-commerce](https://www.libertybank.ge/en/produqtebi/chemtvis/distantsiuri-momsakhureba/e-commerce); [Quickpay.ge](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)

**Others on the NBG register** (41 registered PSPs as of the fetch): these include eMoney Georgia (0001), OPPA (0002), TBC PAY (0005), UNIPAY (0007), Money Movers (0008), Pay Unicard (0052), FastPay, ELECTRA PAY, Keepz Payment System, Tpay (0100) and others. **Flitt, Payze, "OPAY", "Paybox"/"Pay-Box" were not on the registered list.** The register page shows no service categories. — [NBG PSP register](https://nbg.gov.ge/en/payment-system/providers)

### Inferences
- **Simplest compliant MVP:** keep the game balance as a ledger in STIFF's backend, and pay withdrawals from STIFF's own BoG or TBC business account to the user's IBAN through the Bonline bulk or TBC BIS batch API. A human approves each batch in Business Online. Both banks' APIs create orders that are then authorised by the bank's signing rules, so a "maker in code, checker in the bank UI" workflow comes for free.
- **Card-number withdrawals** (user enters a card instead of an IBAN) realistically mean Flitt `p2pcredit`. Because Flitt needs a token from an earlier purchase, the user would have to make a small card payment (for example a shop purchase or a 0.xx GEL verification charge with `required_rectoken=Y`) before withdrawing to that card. Flitt also requires STIFF to bank with TBC.
- Payouts to cards of other Georgian banks via Flitt are plausible (Visa and Mastercard push), but this is not documented. Confirm with Flitt.

### Gaps
- No public payout or card-credit API was found for BoG Payments or iPay, and the Quickpay claim that BoG supports card-to-card was not verified in BoG's docs. Ask BoG merchant services about "card-to-card / OCT for merchants".
- The base URL and a maximum batch size for the BoG bulk endpoint were not found. TBC BIS batch size was not stated (DBI states 1 to 1000).
- It is not clear whether TBC BIS supports transfers to other banks' IBANs. This is likely but not stated on the page fetched.
- No merchant payout API documentation was found for UniPay, Liberty, Keepz, eMoney Georgia or TBC PAY. OPAY and Paybox were not found as Georgian PSPs.
- Visa Direct or Mastercard Move access for a Georgian merchant through an acquirer: no acquirer documentation was found.

## 2. Fees, minimums, speed, daily limits, cross-bank

### Takeaway
Almost no payout pricing is public. The only hard numbers found are: BoG's BULK dispatch is capped at 10,000 GEL per transaction; NBG's interbank bulk payment fee is 0.2 GEL during 09:00 to 17:45 (a central-bank figure, not a bank tariff); and Keepz charges an introductory 0.50 GEL per instant transfer. Every bank and PSP payout fee must be obtained by quote.

### Cited Findings
- BoG Bonline: `DispatchType` BULK only for transactions up to 10,000 GEL; MT103 above that. Commission is debited from `CommissionAccountNumber` or from the source account. No tariff is given. — [BoG bulk-domestic](https://api.bog.ge/docs/en/bonline/documents/bulk-domestic)
- NBG's published fees list a bulk payment at 0.2 GEL during 09:00 to 17:45 (as summarised by search). This is the RTGS/clearing fee, not the retail bank's charge. — [NBG working hours and service fees](https://nbg.gov.ge/en/page/working-hours-and-service-fees)
- Keepz instant transfers: 0.50 GEL introductory price, up to 100,000 GEL per day, 24/7. — [FinChannel](https://finchannel.com/keepz-brings-georgia-its-first-24-7-instant-bank-to-bank-transfer-service/127998/georgian-local-news/2025/10/)
- Acceptance-side context (not payouts): TBC e-commerce charges 2% on Georgian cards, with standard limits of 3,000 GEL per transaction and 10,000 GEL per day, and T+1 settlement for Georgian cards. — [TBC e-commerce](https://tbcbank.ge/en/business/card-payments/e-commerce)

### Inferences
- At 0.50 GEL minimum earnings, any per-transfer fee near 0.2 to 0.5 GEL makes tiny withdrawals uneconomic. Set a minimum withdrawal threshold (for example 10 to 20 GEL) and/or batch weekly.
- Interbank BULK transfers clear in NBG's batch windows, so expect same day or next business day rather than instant. Within-bank transfers (BoG to BoG, TBC to TBC) are typically immediate. This is unverified, so confirm with the banks.

### Gaps
- Not found: BoG and TBC business tariffs for outgoing domestic transfers (own-bank and interbank), Flitt payout fee and limits, Liberty and UniPay payout pricing, daily caps for API-initiated corporate transfers.

## 3. Onboarding, recipient KYC, and whether STIFF needs an NBG licence for a stored balance

### Takeaway
An LLC with a business account is enough for the bank corporate APIs and for Flitt (which also requires a TBC account). Banks and PSPs KYC their merchant (STIFF), not STIFF's payees. STIFF must do its own user KYC and AML. Whether holding user game balances needs an NBG PSP or e-money registration is **unresolved from primary sources** and needs a Georgian lawyer's opinion.

### Cited Findings
- All Georgian gateways require a registered legal entity and a business bank account. — [Quickpay.ge](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)
- Flitt needs a business registered in Georgia (or Uzbekistan, Armenia, Moldova) plus an active TBC account. — [flitt.com/payouts](https://flitt.com/payouts/)
- TBC BIS needs the "Initiate Transactions" permission in Business Internet Banking. — [TBC BIS Transfers](https://developers.tbcbank.ge/docs/bis-transfers)
- The Law of Georgia on Payment Systems and Payment Services defines an "electronic money provider" as a PSP that issues e-money, meaning value received from users and stored. — [NBG law PDF](https://nbg.gov.ge/fm/%E1%83%98%E1%83%9C%E1%83%93%E1%83%98%E1%83%95%E1%83%98%E1%83%93%E1%83%A3%E1%83%90%E1%83%9A%E1%83%A3%E1%83%A0_%E1%83%A1%E1%83%90%E1%83%9B%E1%83%90%E1%83%A0%E1%83%97%E1%83%9A%E1%83%94%E1%83%91%E1%83%A0%E1%83%98%E1%83%95%E1%83%98_%E1%83%90%E1%83%A5%E1%83%A2%E1%83%94%E1%83%91%E1%83%98/%E1%83%9C%E1%83%9D%E1%83%A0%E1%83%9B%E1%83%90%E1%83%A2%E1%83%98%E1%83%A3%E1%83%9A%E1%83%98_%E1%83%90%E1%83%A5%E1%83%A2%E1%83%94%E1%83%91%E1%83%98/english/payment_systems/law-of-georgia-on-payment-systems-and-payment-services.pdf); [NBG law page](https://nbg.gov.ge/en/page/law-on-payment-services)
- NBG's PSP regulation was updated in 2023. The law PDF was not read in full in this pass. — [NBG news on updated PSP regulation](https://nbg.gov.ge/en/media/news/nbg-approves-updated-regulation-on-registration-and-regulation-of-payment-service-provider)
- Consultancy sources disagree on licensing. One says there is no separate EMI registry and a PSP registration covers e-money issuance; another says registration plus a licence is needed. These are not primary sources. — [globallawexperts](https://globallawexperts.com/payment-license-in-georgia/); [pbservices.ge](https://pbservices.ge/service/payment-service-provider-license)
- The NBG fined CPay 14,000 GEL and PayUnicard 39,000 GEL in 2025 for weak AML/KYC, which shows enforcement is active. — [Quickpay.ge](https://quickpay.ge/en/blog/georgian-payment-gateways-comparison)

### Inferences
- **Lower-risk design:** model earnings as STIFF's accrued liability to a user (prize or reward payable by STIFF from its own funds) rather than as users' money deposited and stored. Never let users top up the balance, transfer it to each other, or spend it with third parties. Under that design STIFF is paying out its own money, which looks more like rewards or prize payments than e-money issuance. This is an inference, not legal advice. Have it confirmed by Georgian counsel, together with the tax treatment (personal income tax withholding on payouts to individuals) and any gambling or lottery classification if tasks involve chance.
- **Recipient KYC:** the bank checks only the IBAN format. Optionally `CheckInn` (BoG, own-bank only) matches the beneficiary's personal ID to the account. STIFF should collect the user's name and personal number and match them to the IBAN holder. Using `BeneficiaryInn` and BoG's `CheckInn=true` for BoG recipients gives some name and ID matching.

### Gaps
- Primary NBG text on (a) the e-money or PSP capital and safeguarding rules and (b) whether a merchant-held reward balance counts as e-money was not obtained. The 1,500 GEL cap on low-value e-money instruments came only from a search summary.
- No Georgian provider was found offering a **white-label e-money wallet** for third-party platforms (where the provider holds user balances). UniPay and eMoney Georgia run their own consumer wallets; whether they would host sub-accounts for STIFF users is unknown and needs a direct enquiry.

## 4. NBG Open Banking: can a platform initiate transfers from its own business account?

### Takeaway
Yes in principle. Georgian open banking (NextGenPSD2 / Berlin Group based, v0.8) includes payment initiation, bulk payments and corporate-context headers. But it is built for a licensed third party (TPP) acting for an account holder with bank-side SCA. For STIFF paying from its own account, the bank's own corporate API (Bonline or BIS) is the direct route and needs no PISP status.

### Cited Findings
- NBG updated the PSP regulation in 2023 to add account information and payment initiation services. Non-banks need NBG approval to join; banks are participants by default. Money Movers was approved in November 2024. — [NBG news, Money Movers](https://nbg.gov.ge/en/media/news/open-banking-in-georgia-is-expanding-a-new-member-has-joined-the-ecosystem); [KPMG 2023](https://kpmg.com/ge/en/home/insights/2023/06/non-banking-fin-institutions.html)
- As of April 2025 there were 4 licensed PISPs. — [NBG fintech strategy 2025](https://nbg.gov.ge/fm/%E1%83%96%E1%83%94%E1%83%93%E1%83%90%E1%83%9B%E1%83%AE%E1%83%94%E1%83%93%E1%83%95%E1%83%94%E1%83%9A%E1%83%9D%E1%83%91%E1%83%90/%E1%83%A4%E1%83%98%E1%83%9C%E1%83%A2%E1%83%94%E1%83%A5_%E1%83%93%E1%83%94%E1%83%9E%E1%83%90%E1%83%A0%E1%83%A2%E1%83%90%E1%83%9B%E1%83%94%E1%83%9C%E1%83%A2%E1%83%98/strategia/2025/fintech-development-strategy-of-georgia-updated-version.pdf)
- NBG has added recurring payment initiation, future-dated payments and variable recurring payments for sweeping. Usage passed 9.3 million operations in a year. — [NBG news](https://nbg.gov.ge/en/media/news/nbg-total-usage-of-open-banking-services-exceeds-9-3-million-over-the-past-year)
- BoG PIS endpoints: `POST /v2/payments/{product}` and `POST /v2/bulk-payments/{product}` (bulk requires `numberOfTransactions` and `controlSum`). There are corporate headers `PSU-Corporate-ID`, and SCA is by redirect, embedded or decoupled flow. Sandbox is `https://xs2a-sandbox.bog.ge/0.8/`, production is `https://xs2a.bog.ge/0.8/`. — [BoG Open Finance PIS](https://api.bog.ge/docs/en/bg-ofa-pis)
- Third-party docs say production access needs a QWAC certificate (Georgia v0.8, Berlin Group). — [Paysera Open Banking Georgia](https://developers.paysera.com/guides/open-banking-georgia)

### Inferences
- STIFF would need NBG PISP approval (or a licensed PISP partner such as Keepz or Money Movers) to use PIS. That is not worth it for paying from its own account when Bonline and BIS already do this directly.
- A PISP partner could matter for a single integration across many banks: STIFF holds accounts at several banks and one PISP initiates from each.

### Gaps
- The NBG open banking page returned HTTP 500, so it was not read. Which payment products BoG and TBC actually expose for domestic GEL via PIS, and whether corporate PSUs are supported in production, is not confirmed.

## 5. Manual alternative: salary-style bulk files in Business Online

### Takeaway
It is feasible at small scale. Both BoG and TBC accept batch payment orders (API or import), BoG has an explicit `IsSalary` flag, and TBC DBI takes up to 1000 orders per batch. A weekly export from the NestJS admin, followed by upload or API push and manual signing, is a realistic MVP. One limitation: the salary flag implies employment payments, so for game rewards use ordinary transfers with a clear purpose (`Nomination`).

### Cited Findings
- The BoG bulk domestic package accepts many IBAN payments in one call, with an optional `IsSalary` flag and a duplicate guard. — [BoG bulk-domestic](https://api.bog.ge/docs/en/bonline/documents/bulk-domestic)
- TBC batch import accepts 1 to 1000 orders per request, and BIS has a batch endpoint. Execution follows Business Internet Banking signing rules. — [TBC Import Batch Payments](https://developers.tbcbank.ge/docs/import-batch-payments); [TBC BIS Transfers](https://developers.tbcbank.ge/docs/bis-transfers)

### Inferences
- Suggested MVP pipeline: users request withdrawal to an IBAN (validated, with name and personal ID); a weekly cutoff; STIFF generates a package and pushes it via Bonline or BIS (or uploads a file); the finance owner signs it in the bank UI; then STIFF polls status and marks the ledger as paid. Using the same bank as most users (BoG or TBC) lowers cost and speeds settlement for those users.
- Upgrade path: Flitt `p2pcredit` for instant card withdrawals once volume justifies it and the token-capture flow is acceptable.

### Gaps
- The file layout for manual salary or bulk uploads in the BoG and TBC web UIs was not found. Bank charges per bulk line were not found. Also unknown is whether banks object to "salary" products being used for non-employee payments; use standard bulk transfers instead.

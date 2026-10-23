# Personalized QR stand delivery

## Status on 23 October 2026

New purchases cost ₹299 for one month, ₹1,750 for six months and ₹2,999 for twelve months. Existing mandates retain their agreed amounts. Monthly purchases do not earn partner commission.

Counter card customization is available at **Dashboard → QR code**. It prints the business name above its review QR and a small **QR by Reviyo** line below. The downloadable 4 × 6 inch SVG is a sample, pending a supplier's final artwork template.

Physical delivery is **disabled**. Public pricing says delivery is coming soon and is not included in purchases yet. Address fields stay hidden while it is disabled. There is no production supplier API adapter or dispatch worker yet. Do not enable the offer just because the preparation tables exist.

## Selected fulfilment approach

Use **Qikink print-on-demand dropshipping**, at its published standard rates. The owner explicitly selected a dropshipping service instead of waiting for supplier negotiations on 23 October 2026. A reply or negotiated quote is not a launch prerequisite. Qikink advertises custom 4 × 6 inch acrylic stands, no minimum quantity and direct fulfilment; its official getting-started guide supports custom websites through Open API.

- Product: https://qikink.com/custom/accessories/acrylic-display-stand/
- Custom website integration: https://qikink.com/help/getting-started/how-do-i-get-started/
- Account setup: https://signup.qikink.com/signup

The owner completed account signup. The signed-in dashboard uses their Google account (`ndigitalsolutions9`), rather than the initially prepared support mailbox. Onboarding is complete for an existing store using a custom website and its first fulfilment provider. Wallet balance was ₹0; no payment or real order was made.

With explicit owner confirmation, a sandbox secret was generated and `QIKINK_CLIENT_ID` and `QIKINK_SANDBOX_SECRET` were saved in Supabase Edge secrets. No credentials are in the repository. The live-access request was submitted successfully on 23 October 2026 after the documented API example passed. Qikink's confirmation says an email response within three working days once approved. Live credentials are not yet available.

The API client and developer/server-only sandbox diagnostic are implemented, tested and deployed. JWT gateway verification is off because the function verifies either the existing server secret or a signed-in admin itself; anonymous and ordinary owner requests are rejected. Generate the single-file dashboard deployment with `node scripts/bundle-qikink-sandbox-check.mjs` (the generated output contains no credentials). A sample print PNG and illustrative mockup are publicly hosted. Designer file upload remains blocked by Chrome's file URL permission, but URL-based API artwork does not require that upload.

Verified sandbox results:

- `connection`: HTTP 200, authenticated.
- `sample`: acrylic SKU `UAcryDiSt-Wh-NA` with Accessories print type 5 was explicitly rejected: **Invalid Print Type ID for This SKU** (safe category `product_print_type`). This remains unresolved; do not substitute a guessed print type in production.
- `api_reference_sample`: Qikink's documented `MVnHs-Wh-S` / DTG type 1 example succeeded, order **25378080**, reference **awqrmm9846fiuj**. This verifies API order creation only, **not acrylic stand fulfilment**. This was sandbox only; no real purchase or charge was made.

Diagnostic samples use fixed fictional shipping details and sample artwork, never customer addresses. Keep a sample's UUID/reference across ambiguous attempts; never blindly create a fresh reference after a timeout. Sandbox order lookup is unavailable. Screenshots are local in `output/qikink-api-sample-success.png` and `output/qikink-live-access-requested.png`. No production dispatch or artwork rendering worker exists yet.

The public website's API link is outdated. The signed-in dashboard links to the working official reference at https://documenter.getpostman.com/view/26157218/2sBYAysUHS (Orders 08-25). It was read in the browser; an untracked local text copy is in `output/qikink-api-reference.txt`. Sandbox: `https://sandbox.qikink.com`; live: `https://api.qikink.com`. Use the documented token, create and list contracts, not old ERP endpoints. Listing is documented unavailable in sandbox. Tokens replace the previous token, so a dispatch worker needs a global lock/cache across instances, not only each client's in-memory token cache.

Account catalogue verified: **UAcryDiSt-Wh-NA**, white standard acrylic display stand, front placement, Accessories printing (type 5). Design Guidelines confirm **4 × 6 inches**. The account lists ₹120 base plus printing, 18% tax and 150g shipping weight; the designer showed ₹141.60 before the design and shipping. None of these is the final landed price. Verify the final cost before enabling fulfilment.

Live dispatch remains disabled until sandbox validation, live credentials, authorized funding, landed cost, final artwork/sample validation and the complete dispatch/reconciliation worker exist.

## Earlier supplier enquiries

Quote requests were sent from support@reviyo.in to Qikink (sales@qikink.com) and PrintX (info@printxdesign.com) on 23 October 2026. These were enquiries only, with no order, payment or volume commitment.

- Qikink: https://qikink.com/custom/accessories/acrylic-display-stand/ lists a 4 × 6 inch acrylic stand for ₹165 including print and GST, with shipping extra. This is a public list price, not a negotiated landed quote. Its linked current API documentation returned 404 during research; old API examples must not be assumed current.
- PrintX: https://www.printxdesign.com/qr-code-stands.html advertises custom QR stands with a minimum quantity of ten. Individual shipment and automation support have not been confirmed.

Requested: prepaid landed rates, reseller tiers without volume commitments, individual addresses, artwork/DPI/bleed, account and sandbox steps, current API, duplicate prevention, order lookup, tracking, serviceability, cancellations and replacements. These earlier enquiries are background only; do not wait for them to continue Qikink's standard account setup.

Qikink replied on 23 October (support ticket 132299): ₹165, 3mm acrylic, no MOQ; individual designs and direct API ordering supported. Bulk discounts require 50+ of the same design, so unique business QR artwork does not qualify. Shipping/other charges require panel verification. Their phrase “2 acrylic stands per product listing” needs clarification before treating it as a customer quantity. They recommend a printed sample and physical QR scan before fulfilment. No negotiated rate or volume commitment was accepted.

## Implemented preparation

- `qr_stand_offer` exposes only availability and the supplier's name, not costs or private addresses.
- Owner-only customization; explicit unticked delivery consent is required before saving an address when the offer opens.
- The trusted checkout function freezes the name, business slug, address, consent version and supplier before creating a payable order. Delivery details never enter Razorpay notes.
- A confirmed paid order inserts one stand queue record in the settlement transaction. Unique business and payment constraints prevent duplicate webhook or renewal stands.
- One stand is intended for each business's first paid purchase of any plan after activation. Purchases made while the offer is closed do not include a stand. No renewal stands.
- Stand preferences, orders and supplier settings have RLS and explicit grants. Browser clients cannot write queue records or supplier settings.

## Required before physical launch

1. Verify Qikink's standard prepaid landed cost at checkout, including tax and shipping. Confirm that including a stand with ₹299 remains affordable after shipping and payment costs. A negotiated rate is optional.
2. Complete the Qikink account, applicable terms and funding, with the owner's involvement where required. Keep credentials only in server secrets.
3. Obtain current official API documentation, SKU and final print template; approve a printed sample and scan its QR.
4. Implement and test a dispatch worker using the supplier's documented idempotency/order lookup, with retry recovery, tracking, refund/cancellation handling and reconciliation. Never blindly retry an ambiguous paid supplier order.
5. Verify serviceability and disclose any excluded destinations before checkout. Add confirmed delivery timing and applicable physical-order terms.
6. Only after those gates, set supplier readiness, approved landed unit cost and the enabled flag in `stand_delivery_settings`. Verify a complete sandbox order and tracking flow first.

Until then, use the downloadable/printable counter card. A queued record alone is not a supplier order or proof of shipment.

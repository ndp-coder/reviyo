# Personalized QR stand delivery

## Status on 23 October 2026

New purchases cost ₹299 for one month, ₹1,750 for six months and ₹2,999 for twelve months. Existing mandates retain their agreed amounts. Monthly purchases do not earn partner commission.

Counter card customization is available at **Dashboard → QR code**. It prints the business name above its review QR and a small **QR by Reviyo** line below. The downloadable 4 × 6 inch SVG is a sample, pending a supplier's final artwork template.

Physical delivery is **disabled**. Public pricing says delivery is coming soon and is not included in purchases yet. Address fields stay hidden while it is disabled. There is no production supplier API adapter or dispatch worker yet. Do not enable the offer just because the preparation tables exist.

## Supplier enquiries

Quote requests were sent from support@reviyo.in to Qikink (sales@qikink.com) and PrintX (info@printxdesign.com) on 23 October 2026. These were enquiries only, with no order, payment or volume commitment.

- Qikink: https://qikink.com/custom/accessories/acrylic-display-stand/ lists a 4 × 6 inch acrylic stand for ₹165 including print and GST, with shipping extra. This is a public list price, not a negotiated landed quote. Its linked current API documentation returned 404 during research; old API examples must not be assumed current.
- PrintX: https://www.printxdesign.com/qr-code-stands.html advertises custom QR stands with a minimum quantity of ten. Individual shipment and automation support have not been confirmed.

Requested: prepaid landed rates, reseller tiers without volume commitments, individual addresses, artwork/DPI/bleed, account and sandbox steps, current API, duplicate prevention, order lookup, tracking, serviceability, cancellations and replacements. Supplier replies and sample approval are pending.

## Implemented preparation

- `qr_stand_offer` exposes only availability and the supplier's name, not costs or private addresses.
- Owner-only customization; explicit unticked delivery consent is required before saving an address when the offer opens.
- The trusted checkout function freezes the name, business slug, address, consent version and supplier before creating a payable order. Delivery details never enter Razorpay notes.
- A confirmed paid order inserts one stand queue record in the settlement transaction. Unique business and payment constraints prevent duplicate webhook or renewal stands.
- One stand is intended for each business's first paid purchase of any plan after activation. Purchases made while the offer is closed do not include a stand. No renewal stands.
- Stand preferences, orders and supplier settings have RLS and explicit grants. Browser clients cannot write queue records or supplier settings.

## Required before physical launch

1. Receive and compare landed quotes. Confirm that including a stand with ₹299 remains affordable after shipping and payment costs.
2. Complete the chosen supplier account, applicable terms and funding, with the owner's involvement where required. Keep credentials only in server secrets.
3. Obtain current official API documentation, SKU and final print template; approve a printed sample and scan its QR.
4. Implement and test a dispatch worker using the supplier's documented idempotency/order lookup, with retry recovery, tracking, refund/cancellation handling and reconciliation. Never blindly retry an ambiguous paid supplier order.
5. Verify serviceability and disclose any excluded destinations before checkout. Add confirmed delivery timing and applicable physical-order terms.
6. Only after those gates, set supplier readiness, approved landed unit cost and the enabled flag in `stand_delivery_settings`. Verify a complete sandbox order and tracking flow first.

Until then, use the downloadable/printable counter card. A queued record alone is not a supplier order or proof of shipment.

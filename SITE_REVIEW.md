# Taos Pride Site Review

Reviewed September 28, 2026 against the local application and the currently
published site at taospride.org.

## What the site needs to do

The public site has five distinct jobs:

1. Explain what Taos Pride is and show what is happening next.
2. Publish festival events and year-round events without mixing their lifecycles.
3. Recruit volunteers, vendors, performers, parade participants, and sponsors.
4. Offer safe, understandable ways to contribute financially.
5. Give staff and board members one manageable place for events, meetings,
   applications, communications, photos, and organizational records.

## Completed in the current local version

- Events use start/end dates for chronological ordering and move to Past Events
  automatically. Legacy display dates such as `August 15, 2026` are handled too.
- Festival series can group several events while independent community events
  remain separate.
- Meetings, sponsorship, participation, and contributions can be shown or hidden
  independently of the homepage banner.
- Empty databases no longer invent a meeting or sponsor for public display.
- Contributions have their own admin section with independent Open, Paused, and
  Hidden states.
- PayPal, Venmo, Square, Stripe, and check instructions are individually enabled.
  Online providers use HTTPS hosted payment links; this site never handles card
  or bank credentials.
- The optional contribution acknowledgment form is clearly identified as a
  self-reported note, not payment verification, bookkeeping, or a tax receipt.
- Contribution records require an authenticated admin session. Public submissions
  validate inputs and include a spam honeypot.
- Public event details receive only confirmed performer display fields; performer
  contact details, fees, internal notes, budgets, staffing, and materials remain
  behind the authenticated admin session.
- Newsletter and contribution CSV exports quote fields and neutralize spreadsheet
  formulas supplied through public forms.
- Public navigation hides links whose sections are hidden, and keyboard users can
  activate Get Involved cards.

## Priority before publishing

### 1. Confirm real contribution accounts and wording

Choose which hosted accounts Taos Pride actually controls, copy their public
payment URLs into **Admin → Contributions**, and enable only those methods. Do not
publish a mailing address until it is confirmed. Before using “donation,”
“tax-deductible,” or promising receipts, confirm Taos Pride's legal/tax status and
receipt process. Provider dashboards remain the source of truth for received funds.

### 2. Clean current content

- The local seed data contains two duplicate April 18 meetings.
- The Film Festival has an old internal sort date while its public date is still
  “Date TBD”; either assign a current date or clear/recreate it.
- Review every sponsor, URL, benefit, audience number, and promised deliverable.
  Sponsorship packages currently contain specific claims that should be approved
  annually.
- Replace placeholder or old applications/subscribers/contribution notifications
  before treating the local JSON data as meaningful. Production data is separate.

### 3. Make the admin simpler to maintain

The unified `/admin` area should become the only supported management interface.
After a successful production deployment, remove the legacy `#manage` path and the
retired fixed contribution component. Split the very large `App.tsx` into public,
event, meeting, participation, sponsorship, and contribution modules so future
changes are safer.

## Next improvements

- Add an annual content rollover checklist: create the new festival series, copy
  reusable events as drafts, review sponsorship benefits, and update hero copy.
- Add a contribution reconciliation import only if the team needs it. A CSV import
  from Stripe/Square is preferable to building card processing into this site.
- Add preview links beside all visibility controls so an administrator can confirm
  public presentation before publishing.
- Add field-level URL warnings and a “last saved” timestamp to settings panels.
- Add structured address and map-link fields for events rather than relying on one
  freeform location string.
- Add application export and retention/deletion tools, with a written policy for
  personal information submitted by volunteers and participants.
- Run an annual accessibility/content review covering image alt text, heading order,
  keyboard interaction, link purpose, color contrast, and outdated claims.

## Deployment recommendation

Keep the current cPanel artifact workflow. GitHub builds the Vite application and
produces the upload-ready package, so the computer used to publish does not need
Node, React, or a terminal. Deployment should remain a deliberate manual upload
until production database backups and rollback steps have been exercised.

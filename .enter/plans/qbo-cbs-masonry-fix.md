# Fix the QuickBooks connection for CBS Masonry

## What is actually wrong

CBS Masonry's QuickBooks link broke on **18 Sep 2026** with the error *"Incorrect or invalid refresh token"*. It was never truly restored.

The client has since re-authorized **three times today** (17:31, 20:24, 20:57). Each time QuickBooks accepted the authorization and the app showed a green **"Connected!"** screen. But the CRM record saved the new tokens **without resetting its own status**: it still says *Expired* and still carries the September error message. Two consequences follow:

- The client's QuickBooks panel keeps showing **Expired**, so it looks like the reconnects failed.
- The daily invoice check deliberately **skips any connection marked Expired**. So QuickBooks is never queried for CBS Masonry, no paid invoices are detected, and no review requests are sent. Last review request: **7 Sep 2026**.

Why it broke in the first place: the agency runs two separate scheduled jobs that both renew the same QuickBooks token. QuickBooks issues a **new refresh token every time one is used**, invalidating the old one. When two jobs use the same stored token, the second gets "invalid refresh token" and marks the connection dead — and because the invoice check then skips dead connections, nothing ever recovers it.

## What I will change

- [ ] A successful re-authorization immediately shows **Connected**, clears the old error, and schedules the next invoice check — no daily wait, no manual data edit.
- [ ] The invoice check **recovers** a connection whose stored status is stale instead of skipping it forever; it only marks a connection Expired when QuickBooks actually rejects the credentials.
- [ ] Only one job can renew a token at a time. If a renewal already happened, the second job reuses the new token instead of burning the connection. This removes the recurring "invalid refresh token" breakage.
- [ ] The client-facing finish page stops claiming success when the connection was not actually saved as active.
- [ ] The client panel tells the truth about state: **Connected**, **Connected — last sync failed**, or **Expired**, with the last successful sync time shown; the stale error is no longer hidden in one state and shown in the other.
- [ ] The "connection expired" alert still fires once when a connection dies, and the "QuickBooks connected" notice to Alan still fires on each successful authorization.
- [ ] **CBS Masonry is repaired right away:** connection marked active, old error cleared, and the missed period caught up.

## Catch-up for CBS Masonry (approved)

Invoices paid since the outage will produce review requests again, one per customer email, deduplicated against the 9 requests already sent in Aug–Sep. Expect roughly a dozen or two emails in a single batch on the first sync after the repair.

## Unchanged

Email design, sender name ("CBS Masonry Ltd."), review platform links (Google, Facebook, BBB), the 1-day delay setting, click tracking, and every other client's connection and history.

## Assumptions and limits

- Company file `193514304340427` is CBS Masonry's real QuickBooks company — every authorization attempt used it.
- The backend log search service returned an error, so this diagnosis rests on the connection record, the authorization attempt history, and the job schedules rather than runtime logs.
- Reconnects made with an already-used emailed link will still fail; the fix makes the working path reliable, not old links reusable.

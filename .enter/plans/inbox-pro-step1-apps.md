# Step 1 — Client record and app catalog

This step makes the dashboard the place where a client's apps live. Each client gets an **Apps** tab holding an Inbox Pro card, and a new **Apps** page lists every client's Inbox Pro side by side.

Nothing is sent to Inbox Pro in this step. No provisioning, no sync, no secrets — as instructed. Inbox Pro itself is untouched.

## The client record

Every client keeps a business name, a primary contact email, a plan, a seat count and a status.

The CRM already stores the business name and a billing email for each client, and the existing client status already drives the rest of the CRM. Rather than duplicating those, the Apps work reuses them: business name is the client name shown today, and the primary contact email is the billing email already on the record. Plan and seat count are new fields on the client; until someone fills them in they read **Not set**, never a guessed value.

A client's own plan and seats are stored separately from the Inbox Pro plan and seat limit on that client's Inbox Pro card. They are different things and are never copied from one another.

## The app catalog

The catalog starts with one app: **Inbox Pro**. For each client the dashboard records whether that client has Inbox Pro, and if so: the client's id in Inbox Pro, the workspace name, the Inbox Pro plan, the seat limit, when it last synced, when it was last checked, and the last error.

A client only appears on the Apps page once an Inbox Pro record exists for them. Clients with no record show the empty state instead.

## Client detail → Apps tab

A new **Apps** tab sits next to Overview on every client, so the app assignment is part of the client record rather than buried under Integrations. It contains the Inbox Pro card:

- The app name and a one-line description.
- A status pill: not connected, active, paused or needs attention.
- Plan, seats used against the limit, open conversations, and last activity.
- Primary action **Open Inbox Pro**, with **Manage plan**, **Pause** and **Retry** alongside it.

Seat usage, open conversations and last activity are only meaningful once a real status read exists, which this step does not build. They therefore show **—** with the reason stated on the card, rather than a zero or a made-up figure.

All four actions are visible but inactive, each with its reason shown in place: opening needs a live workspace, and managing, pausing and retrying arrive with the steps that can actually reach Inbox Pro. A card that cannot act says so; it never reports an action as done.

## Apps page

A new **Apps** entry in the CRM section of the sidebar opens a directory listing every client's Inbox Pro with the same status pill, plan, seats, activity and actions as the card. Each row links through to that client's Apps tab. Inbox Pro is presented as one app in a catalog, so the next app can be added later without redesigning the page.

The page shows a single row per client per app, ordered so the clients needing attention come first, then paused, then active, with not-connected clients last.

## Empty state

A client with no Inbox Pro record shows **Not connected yet** and a **Connect Inbox Pro** button. Connecting is provisioning, which this step does not build, so the button states that it is not available yet instead of pretending to start a connection. The client stays on the Apps page, ready for the next step.

## Sample data

Because no Inbox Pro record exists yet, the Apps page needs something to judge. It shows a small set of sample clients, each clearly tagged **Sample**, under a persistent "Sample data — no real Inbox Pro records yet" banner. Sample rows use obviously illustrative names, are never written to the database, and are never mixed in with real rows: as soon as real Inbox Pro records exist, the samples disappear on their own.

This is the only place sample content appears. Real clients, invoices, subscriptions and billing data are never replaced or seeded with demo rows.

## Rules this step holds to

- A client's Inbox Pro only reads **Active** when a successful sync or status read was actually recorded for that client. Since this step records none, no real client can show Active yet; only clearly labelled sample rows demonstrate that state.
- There is no delete anywhere — no button, no menu item, and no backend path that removes a workspace. Later steps pause instead.
- If the app records fail to load, the page shows the error and its reason instead of an empty or encouraging state.
- The dashboard's existing design system, layout, tab strip, sidebar, dark and light themes, and sign-in behaviour are reused as they are. CRM clients, subscriptions, invoices, payments and every other page are unchanged, and Inbox Pro is not modified.

## Limitations after this step

The Apps surfaces can show what has been recorded but cannot connect, sync, pause, retry or open a workspace, because those need the Inbox Pro contract and its server-side secrets, which arrive in the next steps.

## Tasks

- [ ] Each client record carries a business name, primary contact email, plan, seats and status, with plan and seats reading **Not set** until filled in.
- [ ] Inbox Pro exists as the first entry in an app catalog, and a client's Inbox Pro record stores status, client id, workspace name, plan, seat limit, last sync, last check and last error.
- [ ] A client's Apps tab shows the Inbox Pro card with name, description, status pill, plan, seats, activity and the four actions, and never presents an unavailable action as done.
- [ ] A client with no Inbox Pro record sees **Not connected yet**, a **Connect Inbox Pro** button that states connecting is not available yet, and no error or fake success.
- [ ] The Apps page lists every client's Inbox Pro with the same status, plan and actions, ordered with needs-attention first, and links each row to that client's Apps tab.
- [ ] When no Inbox Pro records exist, the page shows clearly tagged sample rows under a sample-data banner, never persisted and never mixed with real clients.
- [ ] Seat usage, open conversations and last activity show **—** with the reason when no status read exists, instead of invented values.
- [ ] Clients, invoices, subscriptions, payments, other tabs and Inbox Pro itself behave exactly as before.

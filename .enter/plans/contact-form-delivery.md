# Contact form: make submissions actually reach you

## What I found

The `/contact` page form is display-only. Pressing **Send Message** never contacts a server: it just swaps the form for a "Message received" panel in the browser. Nothing is emailed, stored or queued, so your test from alanb613@gmail.com was never sent anywhere — the success screen you saw was cosmetic, not a delivery confirmation.

Everything else on the site that collects leads (the free-trial form on `/pricing`) does go through to your CRM, so this is specific to the contact page.

## What will change

- [ ] Submitting `/contact` sends a notification email to **alan@citywidedigital.ca** (the address already published on that page), containing name, business name, email, phone, business type, message and the time it was received, with Reply-To set to the visitor's own address so you can reply directly from your inbox.
- [ ] Each submission is also saved as a lead in the dashboard CRM, source "Website contact form", so a message is never lost even if email delivery hiccups. The full message and the visitor's details sit in the lead's notes/contact record.
- [ ] The form shows honest states: the button disables while sending, the success panel appears only after the server confirms it, and a failed send shows a clear error with your email address as a fallback plus a retry.
- [ ] Basic abuse protection: a hidden trap field, server-side validation and length limits, so bot spam and garbage input don't fill your inbox or CRM.
- [ ] No visual redesign. Layout, copy, direct-lines panel and the Calendly booking button on `/contact` stay exactly as they are.

## How it behaves

- Missing name, business name or a badly formatted email is rejected before anything is sent, with the field highlighted.
- If the CRM save succeeds but the email fails, the lead is still recorded and the visitor sees an error rather than a false "received" message.
- Phone, business type and message stay optional, matching the current form.

## Dependency to verify

Email is sent through the same provider already used for your Google review and QuickBooks notifications (`reviews@citywidedigital.ca`). If its sending key is not currently configured on the backend, I will ask you for it through a secure entry form rather than putting it in code — I can't confirm that from the outside.

## How I'll verify

1. Deploy the contact handler and submit the form from a real browser session.
2. Confirm the provider accepted the message and check the handler's logs for a delivery error, if any.
3. Confirm the new lead appears in the dashboard CRM with the message text.
4. Confirm the failure path shows the error state rather than a success screen.

I cannot read your inbox, so final arrival in alan@citywidedigital.ca is confirmed by you — I'll report exactly what the sending provider returned.

## Assumption

No automatic reply is sent to the visitor; the page's existing "we respond within one business day" wording carries that expectation.

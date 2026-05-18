# Plan: Update Social Profiles UX and Handle Zernio Limits

## Context
The user successfully connected Google Business Profile (GBP) via Zernio. However:
1.  **UX Update**: The UI needs to reflect that the connection was successful (hide the "Connect" button, show "Connected" status).
2.  **Zernio Limits**: The user hit a 402 Payment Required error when trying to connect LinkedIn because Zernio's free tier limits accounts to 2, and requires a payment method on file to proceed further.

## Exploration
- The `social_accounts` table in Supabase should store the connection status. We need to fetch this data in `src/pages/dashboard/social/profiles.tsx` to update the UI.
- The 402 error from Zernio is expected behavior for their free tier. We need to handle this gracefully in the UI, perhaps by showing a specific message about tier limits.

## Design
1.  **Fetch Connections**: Update `SocialProfiles` to fetch existing connections from the `social_accounts` table for the current client (`citywide`).
2.  **Update UI**: Change the card UI to show a "Connected" badge and disable the connect button if the platform is already connected.
3.  **Handle 402 Error**: Update the error handling in `SocialProfiles` to specifically catch the 402/PAYMENT_REQUIRED error and display a user-friendly message about reaching the account limit.

## Verification
- Verify the UI shows GBP as "Connected".
- Verify that attempting to connect a 3rd account shows a clean "Account limit reached" message instead of a raw JSON dump.

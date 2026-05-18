# Plan: Enable GBP Connection for CityWide Digital

## Context
The user (CityWide Digital) needs to connect their own Google Business Profile (GBP) to the platform. Currently, the system enforces GBP connection as a prerequisite for other social platforms, but there is no specific UI or flow for the agency itself to connect its own profile.

## Exploration
- The `social-rpc` function handles the connection logic.
- The `SocialProfiles` page (`src/pages/dashboard/social/profiles.tsx`) is currently designed for clients.
- I need to ensure that the agency (CityWide) can access this flow or has a dedicated "Agency Settings" area to connect their own GBP.

## Design
1.  **Agency Access**: Add a "Connect Agency GBP" button to the main dashboard or a dedicated "Agency Settings" page.
2.  **Flow**: Reuse the existing `social-rpc` logic, but ensure the `client_id` is set to the agency's identifier (e.g., 'citywide').
3.  **Verification**: Ensure that once connected, the agency's GBP is recognized by the system, allowing them to proceed with other integrations.

## Verification
- Navigate to the dashboard and verify the "Connect Agency GBP" button is visible.
- Trigger the connection flow and ensure it correctly links to the 'citywide' agency account.

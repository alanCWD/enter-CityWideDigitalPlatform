# Plan: Investigate Zernio API Integration

## Context
The user is asking if the current social media integration uses the Zernio API and if it requires secret management.

## Exploration
- I have searched the codebase for "zernio" and found no matches.
- The current implementation uses a simulated `social-rpc` edge function that does not yet connect to any real third-party social media API.

## Design
1.  **Clarification**: Inform the user that the current implementation is a scaffold and does not use Zernio.
2.  **Integration Strategy**: If the user intends to use Zernio, I will need to:
    - Obtain the API key from the user.
    - Use `supabase_add_secret` to store it securely in Enter Cloud.
    - Update the `social-rpc` edge function to use the secret via `Deno.env.get()`.

## Verification
- Confirm with the user if they want to integrate Zernio or another social media API provider.

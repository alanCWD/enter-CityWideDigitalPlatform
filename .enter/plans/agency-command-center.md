# Plan: Fix Zernio API Error Handling

## Context
The user is seeing a raw HTML/JSON string dump in the toast notification when attempting to connect to Zernio. The error message contains fragments of a marketing page or documentation (e.g., "Head-to-head comparison", "Planoly Alternative", "Zernio publishes a 99.97% uptime"). This indicates that the `fetch` request to `https://api.zernio.com/v1/oauth/init` is returning a 404 Not Found page (likely an HTML page) instead of a JSON API response.

## Exploration
- The endpoint `https://api.zernio.com/v1/oauth/init` appears to be incorrect or non-existent, causing the Zernio server to return a generic 404 HTML page.
- The edge function is catching this non-2xx response, parsing the HTML as text, and sending it back to the frontend, which then displays the massive string in the toast.

## Design
1.  **Endpoint Verification**: The Zernio API endpoint for OAuth initiation needs to be corrected. Since I don't have the exact Zernio API documentation, I need to ask the user for the correct endpoint or handle the 404 gracefully.
2.  **Error Formatting**: Update the edge function to detect if the response is HTML (e.g., starts with `<` or fails JSON parsing) and return a clean, user-friendly error message instead of dumping the raw HTML text.
3.  **Frontend Toast**: Ensure the frontend toast can handle long error messages gracefully (e.g., truncation or scrolling).

## Verification
- Update the edge function to handle HTML error responses cleanly.
- Ask the user to verify the correct Zernio API endpoint for OAuth initiation.

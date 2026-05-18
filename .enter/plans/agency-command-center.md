# Plan: Debug and Fix Zernio OAuth Integration

## Context
The user is experiencing a "non-2xx status code" error when attempting to connect their Google Business Profile (GBP) via Zernio. The error persists despite adding status codes to the logs.

## Exploration
- The `social-rpc` function is failing when calling `https://api.zernio.com/v1/oauth/init`.
- The error is likely due to an invalid API key, incorrect request body, or Zernio API endpoint mismatch.
- I need to verify the request structure and ensure the API key is correctly retrieved.

## Design
1.  **Debug Request**: Add more detailed logging to `social-rpc` to inspect the exact request being sent to Zernio (headers, body).
2.  **Verify API Key**: Ensure `ZERNIO_API_KEY` is correctly set in the environment.
3.  **Flow Clarification**: Explain to the user that after pressing the button, the system should return an `authUrl`, which the frontend then uses to redirect the user to Zernio/Google for authorization.

## Verification
- Check logs for the exact request payload and response from Zernio.
- Verify the API key is accessible in the edge function.

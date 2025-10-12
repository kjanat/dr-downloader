# Authentication Issue - Current Problem

## Problem Description

The current authentication system in `auth.go` tries to POST directly to a Blackmagic Design API endpoint, but this approach is failing with 400 Bad Request errors. The issue is that Blackmagic Design requires proper form submission simulation, not direct API calls.

## Current Broken Approach

- `GetAuthenticatedDownloadURL()` in auth.go attempts direct HTTP POST to `/api/register/us/download/{uuid}`
- Uses form-encoded data but doesn't simulate the actual browser form submission
- Results in 400 Bad Request from Blackmagic Design servers
- Even with real user data, the approach is fundamentally wrong

## Required Solution

Need to implement proper form submission that:

1. Visits the actual download page: <https://www.blackmagicdesign.com/event/davinciresolvedownload>
2. Fills out the registration form as a browser would
3. Submits the form properly to get the authenticated download URL with `?verify=...` parameter
4. Extracts the resulting download URL from the response

## Technical Requirements

- Must simulate actual browser form submission
- Should handle form tokens/CSRF if present
- Must extract the final download URL with authentication parameters
- Should work with real registration data (fake data will still be rejected)

## Files to Modify

- `auth.go`: Complete rewrite of GetAuthenticatedDownloadURL function
- May need additional HTTP session handling
- Consider using a headless browser approach or detailed HTTP form simulation

## Current Status

- Authentication system is non-functional
- User gets 400 Bad Request when trying to authenticate
- Direct URL downloads return 403 Forbidden (as expected)
- Need to implement proper web form automation

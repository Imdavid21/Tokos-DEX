# Tokos DEX security notes

The current 1delta integration is non-custodial. Tokos must never receive user private keys or sign normal user transactions server-side.

The 1delta API key is a server secret only. Browser code calls Tokos BFF routes, which validate and forward a fixed set of swap parameters to a fixed upstream origin.

Before production, add request rate limiting, transaction simulation where practical, route/destination validation that does not mutate 1delta calldata, token/address blocklists, telemetry redaction, and fork-based E2E coverage.

Execution invariant: mine all returned permissions first, preserve ordered setup transactions, and execute exactly one selected alternative. Never execute every alternative.

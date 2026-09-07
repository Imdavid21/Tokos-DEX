# Tokos 1delta BFF

Routes:
- `GET /api/tokos/quote`
- `GET /api/tokos/swap/build`

Set `ONEDELTA_API_KEY` as a server-side deployment secret for production rate limits. `ONEDELTA_API_URL` is an optional server-side override for development and testing. The default upstream is `https://portal.1delta.io`.

Do not add either value to browser-exposed `VITE_*` environment variables.

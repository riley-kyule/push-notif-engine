# Laravel Integration Guide

Superseded — this was the original planning note before the starter package
existed. See [integrations/laravel/README.md](../integrations/laravel/README.md)
for the current install-and-go guide. The package now registers
`/push-sw.js`, `/manifest.json`, and `/assets/epe-sdk.js` as routes
automatically (generated from config on every request) — there's nothing to
publish into `public/` or keep in sync during deployment.

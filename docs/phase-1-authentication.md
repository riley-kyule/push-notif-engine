# Phase 1: Security and Access Control

## Goal

Deliver secure authentication and authorization for the platform.

## Scope

* Login with email and password
* JWT access tokens
* Refresh token rotation
* RBAC authorization
* Audit log foundation
* Rate limiting hooks

## API Endpoints

* `POST /api/auth/login`
* `POST /api/auth/refresh`
* `GET /api/auth/me`
* `GET /api/auth/admin-only`

## Database Tables

* `roles`
* `users`
* `refresh_tokens`
* `audit_logs`

## Notes

* Password hashing uses Argon2
* Access and refresh tokens use separate signing secrets
* Refresh tokens are hashed before storage
* Dashboard development mode may fall back to a local auth session when the Nest API is offline
* Local dev credentials: `admin@example.com` / `Password123!`

# API error responses

EPE returns every API failure in the same JSON envelope:

```json
{
  "success": false,
  "error": {
    "message": "A required database, queue, or external service could not be reached. Check service health and retry. Error reference: 85d955dd-3527-4f57-a1d2-bb28973bd115.",
    "statusCode": 503,
    "code": "DEPENDENCY_UNAVAILABLE",
    "retryable": true,
    "errorId": "85d955dd-3527-4f57-a1d2-bb28973bd115"
  }
}
```

Validation failures may also contain `details`, with one entry for every invalid
field. `message` contains the joined validation messages for compatibility with
clients that only display that field.

## Fields

- `message`: safe, user-facing explanation and suggested next action.
- `statusCode`: HTTP response status.
- `code`: stable machine-readable error category.
- `retryable`: whether retrying without changing the request may succeed.
- `errorId`: unique reference included in the `X-Error-Id` response header and
  server log entry.
- `details`: optional list of validation failures.

The global filter recognizes authentication and authorization failures, missing
resources, state conflicts, rate limits, PostgreSQL constraint and schema
errors, unavailable dependencies, and dependency timeouts. Unknown server
failures use `INTERNAL_ERROR` and instruct the caller to provide `errorId` to
support.

Raw database messages, SQL, stack traces, credentials, and internal constraint
names are logged server-side only. Search API logs for `[<errorId>]` to find the
corresponding internal exception.

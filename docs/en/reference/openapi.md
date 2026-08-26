# OpenAPI Specification

The full OpenAPI 3.0 specification for the ApiPay REST API is [openapi.yaml](https://github.com/bazarbaykz/apipay-docs/blob/main/openapi.yaml).

You can import the file into [Swagger Editor](https://editor.swagger.io/), [Postman](https://www.postman.com/)
or [Insomnia](https://insomnia.rest/), and into any other OpenAPI-compatible tool.
You get a ready-made request collection, field descriptions and response schemas for testing your integration.

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://api.apipay.kz/api/v1` |
| Authentication | Header `X-API-Key: your_api_key` |
| Overall rate limit | 200 requests/minute per API key |

Separate limits for some endpoints are described in [Errors](../errors.md).

## Partner API

The [Partner API](../partner-api.md), meant for CRM integrators who onboard merchants
and issue invoices on their behalf, has a specification of its own:
[Partner API OpenAPI Specification](openapi-partner.md).

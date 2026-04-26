# IDOR on Invoice Export

## Severity
High

## Vulnerability Type
Insecure Direct Object Reference

## Affected Asset
`https://api.neonbank.test/v1/invoices/{invoice_id}/export`

## Summary
The invoice export endpoint accepts a predictable `invoice_id` and returns invoice PDFs for accounts outside the authenticated user's organization. Authorization appears to validate that the requester is logged in, but does not validate ownership of the requested invoice.

## Steps to Reproduce
1. Sign in as `analyst@tenant-a.test`.
2. Export a valid invoice from Tenant A and capture the request.
3. Replace the `invoice_id` path value with an invoice ID from Tenant B.
4. Send the modified request with the original Tenant A session cookie.
5. Observe that the response returns a Tenant B invoice PDF.

## Proof of Concept
Original request:

```http
GET /v1/invoices/inv_tenant_b_1042/export HTTP/1.1
Host: api.neonbank.test
Cookie: session=tenant_a_session
Accept: application/pdf
```

Observed response:

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-inv_tenant_b_1042.pdf"
```

The response body contained Tenant B billing metadata, including company name, billing email, invoice line items, and the last four digits of the payment method.

> Expected behavior: Tenant A users should receive `403 Forbidden` or `404 Not Found` for invoices outside their tenant.

## Impact
- Cross-tenant disclosure of billing records.
- Exposure of customer names, billing email addresses, invoice line items, and payment metadata.
- Potential compliance impact if invoice details contain regulated customer information.

## Remediation
- Enforce tenant ownership checks before generating invoice exports.
- Use non-enumerable identifiers where possible.
- Add regression tests for cross-tenant invoice access.
- Log and alert on repeated invoice export misses across tenant boundaries.

## References
- [OWASP IDOR prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)

## Raw Notes
Tags to apply in HuntFlow: `high`, `needs-report`, `idor`, `billing`.

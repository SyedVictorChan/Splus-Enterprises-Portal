# Security Specification & Test Suite

## 1. Data Invariants
- Only authenticated users whose emails belong to authorized organization domains/accounts can read organization data.
- Unauthenticated users have zero read/write access to any collection (`match /{document=**} { allow read, write: if false; }`).
- Administrative users can manage settings, team user roles, and full data deletion.
- Regular users cannot elevate their own role to `admin` or write into the `/admins` collection.
- Initial admin `farazrizvi2002@gmail.com` is bootstrapped as organization administrator.
- Sales records and organization metrics are protected from public access or tampering.

## 2. The Dirty Dozen (Adversarial Payloads)
1. **Unauthenticated Read on Sales Records**: Anonymous actor attempts `GET /sales_records/{id}` -> Expect: PERMISSION_DENIED.
2. **Unauthenticated Read on Users**: Anonymous actor attempts `GET /users/{id}` -> Expect: PERMISSION_DENIED.
3. **Self-Role Privilege Escalation**: Normal user attempts to update own `role` to `'admin'` -> Expect: PERMISSION_DENIED.
4. **Direct Write to /admins**: Non-admin user attempts `CREATE /admins/{uid}` -> Expect: PERMISSION_DENIED.
5. **Ghost Field Injection**: User attempts to inject `isSuperUser: true` into a profile -> Expect: PERMISSION_DENIED.
6. **Negative Units or Price Injection**: Malicious write with corrupted negative sales or unvalidated string types -> Expect: PERMISSION_DENIED.
7. **Document ID Spoofing**: Path variable with arbitrary 2KB malformed script tags -> Expect: PERMISSION_DENIED.
8. **Settings Modification by Contributor**: Team member attempts `SET /organization_settings/main` -> Expect: PERMISSION_DENIED.
9. **Tampering with Another User's Profile**: Authenticated User A tries to overwrite User B's profile document -> Expect: PERMISSION_DENIED.
10. **Sales Record Deletion by Team Member**: Standard team member attempts `DELETE /sales_records/{id}` -> Expect: PERMISSION_DENIED.
11. **Blanket Query Scraping**: Attempting to query entire database without authentication -> Expect: PERMISSION_DENIED.
12. **Email Spoofing Attack**: Token claiming admin email with unverified status attempting admin escalation -> Expect: PERMISSION_DENIED.

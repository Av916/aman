# Staff permissions

A venue is accessible through verified business ownership, an explicit active staff assignment to that venue, or administrator authority. Valid sessions still carry the existing account role. A staff membership grants only the operations listed for its assigned venues. The API rechecks a membership inside write transactions.

| Permission                                  | Verified owner | Manager | Receptionist | Accountant | Ground staff |
| ------------------------------------------- | -------------- | ------- | ------------ | ---------- | ------------ |
| Calendar and reservation summaries          | Yes            | Yes     | Yes          | Yes        | Yes          |
| Manual booking                              | Yes            | Yes     | Yes          | —          | —            |
| Offline collection                          | Yes            | Yes     | Yes          | —          | —            |
| Attendance                                  | Yes            | Yes     | Yes          | —          | Yes          |
| Operator cancellation and rescheduling      | Yes            | Yes     | —            | —          | —            |
| Financial reports and analytics             | Yes            | Yes     | —            | Yes        | —            |
| Request refund or record offline settlement | Yes            | —       | —            | Yes        | —            |
| Customer directory                          | Yes            | Yes     | Yes          | —          | —            |
| Calendar maintenance                        | Yes            | Yes     | —            | —          | —            |
| Owner responses to reviews                  | Yes            | Yes     | —            | —          | —            |
| Manage staff, policies and coupons          | Yes            | —       | —            | —          | —            |

Invitations expire after 48 hours. The database stores a SHA-256 token hash. The authenticated invitee must have the named verified email address. The plaintext token travels in the email link and the delivery payload. A transaction consumes the invite and creates venue assignments together. Staff can use their player account normally when outside the owner workspace. Suspension or removal revokes operational access without changing the user’s role.

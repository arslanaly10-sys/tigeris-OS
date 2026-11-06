# Week 1 — Foundation

## Working now
- **Sign-in:** choose one of two fictional institutions → simulated institutional SSO (choose the person at the identity provider) or labelled demo entry (choose a role) → simulated MFA step with a demo code. Passwords are never stored.
- **Seven roles** with a server-enforced permission matrix. Refused requests return a clear message and are written to the audit trail.
- **Role switcher** in the header (moves to a colleague with that role; audited). Switch institution, one-click demo reset, sign out.
- **Isolation between institutions** by PostgreSQL row-level security (forced, non-owner app role). A live check in Governance & Audit proves the other institution is invisible.
- **Hash-chained audit trail**: append-only, verifiable in the app; a tampered event is detected and located (covered by a test).
- **OS shell** with the PRD's 11 modules plus Reports, Architecture and About. Modules not built yet show what arrives and in which week.
- **Command Centre** (week-1 version): attention queue and map placeholders, the signed-in role's permissions, institution context.
- **Header context:** environment, data mode, Demonstration Mode badge, notifications, search across modules.
- **Dark (default) and light themes**; **English / Arabic draft** for navigation and key screens with right-to-left layout; layout density adapts to role; desktop and tablet.
- **Reasoning service** skeleton with the four fixed horizons as explicit date windows.
- **Delivery:** Docker Compose package (verified end to end here for database, seed, API and web), CI workflow, CLAUDE.md, README, four ADRs.

## Tests
- API 11 · shared 6 · web 3 · reasoning 2 — all passing. Typecheck clean across packages. Production web build passes.

## Not done / blocked
- The reasoning container could not be built in this sandbox: Docker Hub returned "429 Too Many Requests" for the Python base image. Its tests pass outside Docker; retry the build later or on the VM.
- Code is committed locally only. GitHub access in this session is invalid (SCOPE B1).

## Next (week 2): evidence spine
Source registry · public snapshot scripts · validation and quarantine · evidence vault · PDF ingestion with cited facts · lineage panel · Data & Sources module · poisoned-document quarantine · Postgres job queue. Needs network access to the public data hosts (SCOPE B2).

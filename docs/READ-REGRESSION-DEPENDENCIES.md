# Read-path cross-repository regression dependencies

## 2026-10-13 local integration acceptance

Recommended model/speed: GPT-6.1 Sol / high. This repairs the missing local
regression environment; application source and test assertions are unchanged.
The previous missing `PLATFORM_CORE_TEST_WORKTREE` failure and four skipped
fixtures remain historical results. They are superseded only for the exact
source heads actually executed below, not retroactively reclassified.

| Work order | Tested source HEAD | Full suite | Fail / skip |
| --- | --- | --- | --- |
| C1 | `5574c95ca66189195fee7dff81106cb3715360d0` | 853/853 | 0 / 0 |
| C2 | `19ba09da450cf889b691f3778c16ef284b203468` | 868/868 | 0 / 0 |
| C3 | `c26b5b966dd1dbeedf372cf7c7762e8669f996b7` | 938/938 | 0 / 0 |
| C4 | `08b46686b5a85b6d28d407ee4e74f8513d685fb5` | 951/951 | 0 / 0 |
| C5 | `1d344aaf7fb901d2ca653f6034714989f7a8eff1` | 956/956 | 0 / 0 |
| C6 | `414eb1f3d2efa7d29d1c1e348acb65915dcfc821` | 959/959 | 0 / 0 |

All six existing full suites executed sequentially with Node26.5.0/macOS arm64
and a newly initialized PostgreSQL16.14 cluster. The clean Core checkout is
pinned at `643c1b3ab8318966a5beb1917ae7b489be977502`. No Core source or
production database changed. The mandatory commercial roundtrip uses the
original Apps Script functions, actual restricted loopback HTTP services and
real PostgreSQL migrations/transactions. The other four product-access cases
use actual Core Fastify route handlers through `inject()` and synthetic
repository rows; they do not establish socket/production database acceptance.

## Isolation and reproduction requirements

- Use a clean pinned Core checkout containing both fixture scripts and the
  installed API `tsx` dependency. Verify CMWebs source HEAD and tracked diff
  before and after every full suite; preserve unrelated untracked WIP.
- Create a new private disposable cluster. This run used vendor package
  `@embedded-postgres/darwin-arm64@16.14.0-beta.17`, verified npm integrity and
  binary version. No system PostgreSQL service or repository dependency was
  installed. Bind only127.0.0.1 and a private Unix socket, use a random
  disposable bootstrap password and SCRAM, and discard the bootstrap file.
- Pass only the fixture's local `DATABASE_URL` and pinned
  `PLATFORM_CORE_TEST_WORKTREE` plus minimal executable/locale/timezone/temp
  configuration. Do not inherit remote database, deployment or credential
  environment. Do not use `ALLOW_DISPOSABLE_DATABASE` to bypass target checks.
  Run the unchanged `node --test tests/*.test.mjs` suite; do not skip the
  mandatory integration case or weaken assertions to obtain a green result.
- Before any fixture mutation, SQL must verify the new cluster's exact private
  data directory, listen address, port, version and bootstrap identity, with
  only the original three databases and bootstrap/system roles. After each
  suite, verify no fixture database or role remains. Each test fixture creates
  and drops only its own random synthetic database and roles.
- Bound startup, test and cleanup waits. Independent review reproduced a
  cleanup timeout defect; four fake startup/stop/interrupt cases pass after
  remediation, plus eight target/environment guards. Cleanup failures retain
  a safe failure record and never count as a clean run.

## Actual rollback readback and evidence boundary

After every suite, SQL proved no disposable database or fixture role remained.
Final cleanup verified successful fixed-cluster stop, `pg_ctl status` terminal,
no postmaster PID file and closed loopback TCP listener. No cleanup error.
The Core checkout remains clean at the same HEAD; CMWebs tracked source is
unchanged. Sealed logs and generated synthetic cluster remain outside Git;
no connection string, credential, receipt or real business data is published.

These results prove source/HTTP/PostgreSQL regression for the listed heads.
They do not prove C1's actual72-hour or900s/day gate, C3 strict authenticated
latency, real D1/500-room behavior, C5 seven full days, physical LINE/device,
current production serving state or C6 cutover. Linux/Node22 CI evidence remains
separate from this macOS/Node26 full-suite evidence. All later read-path gates
remain mandatory; no formal deployment, Property, trigger or flag is changed.

## October13 C6 v4 runtime follow-up

The new runtime/dataset changes required a fresh full C6 run only; the other
five source suites were not repeated. Exact C6 source
`1cab31076ac82e35bb5c264d80ce0c7cc2c46240`:962/962, zero fail/cancel/skip,
2.871s. Unit957/957 and Worker31/31 are separate counts. The same clean pinned
Core643c1b3 and verified16.14 vendor were reused read-only, with a newly created
0700 private directory and fresh fixed loopback cluster. No prior cluster,
default/inherited connection or formal database was reused. All guards and
finite emergency teardown remained unchanged; eight target/env guard cases pass.

Original GAS commercial restricted-HTTP/real-PG and four synthetic Core
handler cases pass. SQL before/after verifies original three databases/bootstrap
role and no fixture residues. Actual final pg_ctl status, absent PID and closed
listener pass; cleanup errors are empty. Core/C6 tracked sources stay unchanged
through the test; generated secrets/raw logs remain0600 outside Git. Later
documentation refreshes are not substituted for this tested exact source head.

This v4 source check still does not establish uncached C3 latency, actual72h/
900s/day, seven-day shadow, remote500-room/device or a current formal release.

## October13 C6 v5 pinned working-source follow-up

Actual `npm test` passes963/963, zero fail/cancel/skip,3.193s. This is an
uncommitted v5 candidate at checkout baselinebcde36b, not a test of immutable
published v4 HEAD. All537 tracked working files were SHA256-pinned before/after;
immutable snapshot identity:
`ec2a7bca3baa1c1edc58d5bb02378a0ab191b5038cf836dab591e810e3de6ed8`.
This includes current runtime/calendar fixes and source/cache/comparison files.
Later evidence-document updates are not retroactively included in that snapshot.
The code comparison remains178-source
`read-e48be6b9ef38b1ef417d935980d9ec49bebe19fae81b1f2a2e51a35c9eb8fe2f`.

Fresh0700 private PG16.14 cluster uses the same verified vendor read-only and
clean Core643c1b3. Driver rejects source drift/unpinned test files and still checks
loopback/data directory/identity, SQL fixture cleanup and finite emergency stop.
Real `npm test` uses two distinct empty0600 private user/global npm configs,
private cache/logs, disabled update notifier and rejects project .npmrc without
reading contents. Eight target/env, six snapshot and three npm guard cases pass;
independent safety review passes. No inherited database/deployment/OAuth env,
existing cluster, registry credential/config or system PG service is used.

Mandatory original GAS restricted HTTP/PG and four synthetic Core handlers pass.
SQL before/after proves only bootstrap/original databases and no fixture roles;
final PID absent/TCP closed/stopped state passes with no cleanup error. No sources
changed during execution. Source logs/generated cluster stay private outside Git.
Separate Worker32/32 includes new500-room authenticated/scoped-D1 correctness;
its LINE/Google authority transport and GAS service adapters remain synthetic.
All earlier performance failures are retained; no C1/C3/C5/C6 real gate is inferred.

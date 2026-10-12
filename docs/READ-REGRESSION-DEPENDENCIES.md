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

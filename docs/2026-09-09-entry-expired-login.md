# Landlord entry expired-session repair

Recommended model/speed: gpt-5.6-terra / medium.
V2 correctness repair; isolated from main b5c086f. No backend or financial changes.

Root cause: isLoggedIn can precede a rejected getProfile; the entry had no
expired-session handling and rendered the generic registration CTA. Reproduced
with the production renderer before implementation (red regression).

Expired/invalid access-token messages now render an explicit re-login state.
No automatic redirects, no new registration. One user click disables the action
immediately. External browser clears the SDK login and calls login with a clean
entry URL. LIFF browser reopens the configured LIFF URL instead of calling
unsupported login/logout APIs. Failed SDK actions restore the re-login UI.
Existing validated return_to is retained, OAuth code/state are not replayed.
When a local `file://` fixture is opened, both the expired-session and logged-out
branches use the deployed HTTPS entry URL instead of sending a rejected file URL
to LINE.
This reuses current identity flows, not a new login/account system.

Reference: https://developers.line.biz/en/docs/liff/developing-liff-apps/
LIFF browser login is performed by init; external and LINE in-app browsers use
login/logout. Reopening LIFF still requires actual device acceptance; no claim
that SDK refresh behavior has been proven by mocks.

Verification: tests/entry-expired-login.test.mjs exercises init/profile expiry,
entry load, normal login, network error, platform branches, duplicate clicks,
and SDK failure. Full189 regression tests passed before documentation update.
No Production login/logout, account mutation, mail or LINE sends performed.
Final full suite189/189 and static release-cache checks pass. Parent npm validate
targets the legacy package, not this candidate. Explicit candidate validation
passes syntax, declarations and links, but retains the pre-existing nested
tenant_payment_account_cover handler-detection failure (87/88); no route was
added or modified by this repair.

Release marker is prepared as `20260909-entry-expired-login-v1`; all pages with
an explicit older cache query were advanced to this marker. The candidate is
ready for the user-authorized frontend release; after merge, verify Pages source
and then real iPhone/external login return.
No Apps Script redeployment required. Rollback is frontend revert to b5c086f;
data and account records must not be changed as rollback.

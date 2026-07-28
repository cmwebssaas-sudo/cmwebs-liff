/**
 * CMWebs V2 LINE Rich Menu control boundary.
 *
 * Rich Menu presentation is owned exclusively by LINE Official Account
 * Manager.  V2 must never assign a menu to an individual user because that
 * would override the currently published OA Manager experience.
 */
const RICH_MENU_MODE = 'OA_MANAGER_DEFAULT_ONLY';

function getCmwebsRichMenuMode_() {
  return RICH_MENU_MODE;
}

function cmwebsRichMenuNoopResult_() {
  return {
    skipped: true,
    reason: RICH_MENU_MODE
  };
}

/**
 * Compatibility boundary for legacy tenant binding integrations.
 * No identifiers are accepted or logged in OA Manager default-only mode.
 */
function assignCmwebsTenantRichMenu_() {
  return cmwebsRichMenuNoopResult_();
}

/**
 * Compatibility boundary for legacy landlord onboarding integrations.
 */
function assignCmwebsLandlordRichMenu_() {
  return cmwebsRichMenuNoopResult_();
}

/**
 * Compatibility boundary for login, profile, and role-resolution flows.
 */
function syncCmwebsUserRichMenu_() {
  return cmwebsRichMenuNoopResult_();
}

/**
 * Compatibility boundary for any retained per-user Rich Menu assignment call.
 */
function linkCmwebsRichMenuForUser_() {
  return cmwebsRichMenuNoopResult_();
}

/**
 * Fail-closed staging wrapper for landlord registration.
 * This module belongs only to the isolated staging Apps Script tree.
 */
function registerStagingLandlordWorkspaceByLineUid_(
  stagingMarker,
  lineUserId,
  landlordName,
  phone,
  email,
  workspaceName,
  profileDisplayName,
  profilePictureUrl
) {
  const environment = String(
    PropertiesService.getScriptProperties().getProperty(
      'CMWEBS_ENVIRONMENT'
    ) || ''
  ).trim().toLowerCase();

  if (
    environment !== 'staging' ||
    String(stagingMarker || '').trim() !== '1'
  ) {
    return {
      success: false,
      ok: false,
      code: 'STAGING_ENVIRONMENT_REQUIRED',
      message: '房東 staging 註冊僅允許在隔離的 staging 環境執行',
      data: null
    };
  }

  return registerLandlordWorkspaceByLineUid_(
    lineUserId,
    landlordName,
    phone,
    email,
    workspaceName,
    profileDisplayName,
    profilePictureUrl
  );
}

/**
 * Rehearsal-only adapter. This file is intentionally excluded from the RC
 * production candidate and is not invoked by the source-freeze work unit.
 */

function runCmwebsV2Rc1RehearsalMigration() {
  if (
    typeof assertCmwebsRehearsalRuntime_ !== 'function' ||
    typeof getCmwebsRehearsalSpreadsheet_ !== 'function'
  ) {
    throw new Error('REHEARSAL_RUNTIME_HELPER_REQUIRED');
  }

  assertCmwebsRehearsalRuntime_();

  return migrateCmwebsV2Rc1Spreadsheet_(
    getCmwebsRehearsalSpreadsheet_(),
    { schemaVersion: CMWEBS_V2_RC1_SCHEMA_VERSION_ }
  );
}

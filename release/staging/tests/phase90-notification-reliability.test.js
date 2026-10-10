'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createFixture } = require('./phase88-notification-service.test.js');


function rowObject(sheet, rowNumber) {
  const headers = sheet.values[0];
  const values = sheet.values[rowNumber - 1];
  return headers.reduce((result, header, index) => {
    result[header] = values[index];
    return result;
  }, {});
}


function options(referenceId) {
  return {
    receiver: {
      receiver_type: 'tenant',
      receiver_id: 'TFIX88',
      workspace_id: 'WFIX88'
    },
    template_key: 'bill_created',
    variables: {
      tenant_name: 'Fixture tenant',
      month: '2026-08',
      amount: '1,688',
      due_date: '2026-08-10'
    },
    source: 'phase90_test',
    event_type: 'bill_created',
    reference_id: referenceId,
    metadata: {
      bill_id: referenceId,
      access_token: 'must-never-be-stored'
    }
  };
}


function scenarioAHealthyLine() {
  const { context, spreadsheet, requests } = createFixture();
  const result = context.notificationSendLineText_(options('REF-90-A'));
  const queue = spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE');
  const job = rowObject(queue, 2);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.queue_status, 'sent');
  assert.strictEqual(job.status, 'sent');
  assert.strictEqual(Number(job.retry_count), 0);
  assert.ok(job.sent_at);
  assert.strictEqual(requests.length, 1);
}


function scenarioBFirstFailureRetriesInFiveMinutes() {
  const before = Date.now();
  const { context, spreadsheet } = createFixture({ httpStatus: 500 });
  const result = context.notificationSendLineText_(options('REF-90-B'));
  const job = rowObject(spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE'), 2);
  const retryAt = new Date(job.next_retry_at).getTime();

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.data.queue_status, 'retrying');
  assert.strictEqual(job.status, 'retrying');
  assert.strictEqual(Number(job.retry_count), 1);
  assert.ok(retryAt >= before + 4.9 * 60 * 1000);
  assert.ok(retryAt <= Date.now() + 5.1 * 60 * 1000);
  assert.ok(String(job.last_error).includes('HTTP 500'));
}


function scenarioCThirdFailureIsTerminal() {
  const { context, spreadsheet, requests } = createFixture({
    httpStatuses: [500, 502, 503]
  });
  const first = context.notificationSendLineText_(options('REF-90-C'));
  const queueId = first.data.queue_id;

  const second = context.notificationQueueProcessById_(queueId, true);
  let job = rowObject(spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE'), 2);
  const secondRetryAt = new Date(job.next_retry_at).getTime();

  assert.strictEqual(second.success, false);
  assert.strictEqual(job.status, 'retrying');
  assert.strictEqual(Number(job.retry_count), 2);
  assert.ok(secondRetryAt >= Date.now() + 29.9 * 60 * 1000);

  const third = context.notificationQueueProcessById_(queueId, true);
  job = rowObject(spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE'), 2);

  assert.strictEqual(third.success, false);
  assert.strictEqual(job.status, 'failed');
  assert.strictEqual(Number(job.retry_count), 3);
  assert.strictEqual(job.next_retry_at, '');
  assert.strictEqual(requests.length, 3);

  const log = spreadsheet.getSheetByName('V2_notification_logs');
  const retryColumn = log.values[0].indexOf('retry_count');
  assert.deepStrictEqual(
    log.values.slice(1).map(row => Number(row[retryColumn])),
    [1, 2, 3]
  );
}


function scenarioDDuplicateEventDoesNotResend() {
  const { context, spreadsheet, requests } = createFixture();
  const first = context.notificationSendLineText_(options('REF-90-D'));
  const second = context.notificationSendLineText_(options('REF-90-D'));
  const queue = spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE');

  assert.strictEqual(first.success, true);
  assert.strictEqual(second.success, true);
  assert.strictEqual(second.code, 'NOTIFICATION_DUPLICATE');
  assert.strictEqual(second.data.duplicate, true);
  assert.strictEqual(queue.values.length, 2, 'one header and one job only');
  assert.strictEqual(requests.length, 1, 'LINE called once only');
}


function scenarioEStaleProcessingRecoversOrFails() {
  const healthy = createFixture();
  healthy.context.notificationQueueEnqueue_(options('REF-90-E1'));
  const queue = healthy.spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE');
  const statusColumn = queue.values[0].indexOf('status');
  const processingColumn = queue.values[0].indexOf('processing_at');
  queue.values[1][statusColumn] = 'processing';
  queue.values[1][processingColumn] = new Date(Date.now() - 11 * 60 * 1000);
  const recovered = healthy.context.notificationQueueWorker_(20);
  const recoveredJob = rowObject(queue, 2);
  assert.strictEqual(recovered.stale_recovered_count, 1);
  assert.strictEqual(recoveredJob.status, 'sent');
  assert.strictEqual(Number(recoveredJob.retry_count), 1);

  const exhausted = createFixture();
  exhausted.context.notificationQueueEnqueue_(options('REF-90-E2'));
  const exhaustedQueue = exhausted.spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE');
  const exhaustedStatusColumn = exhaustedQueue.values[0].indexOf('status');
  const exhaustedProcessingColumn = exhaustedQueue.values[0].indexOf('processing_at');
  const retryColumn = exhaustedQueue.values[0].indexOf('retry_count');
  exhaustedQueue.values[1][exhaustedStatusColumn] = 'processing';
  exhaustedQueue.values[1][exhaustedProcessingColumn] =
    new Date(Date.now() - 11 * 60 * 1000);
  exhaustedQueue.values[1][retryColumn] = 2;
  const failed = exhausted.context.notificationQueueWorker_(20);
  const failedJob = rowObject(exhaustedQueue, 2);
  assert.strictEqual(failed.stale_failed_count, 1);
  assert.strictEqual(failedJob.status, 'failed');
  assert.strictEqual(Number(failedJob.retry_count), 3);
  assert.strictEqual(exhausted.requests.length, 0);
}


function templateAndLogSecurity() {
  const { context, spreadsheet } = createFixture();
  const rendered = context.notificationTemplateRender_('contract_expiring', {
    tenant_name: 'Fixture tenant',
    end_date: '2026-12-31'
  });
  assert.strictEqual(rendered.success, true);
  assert.ok(rendered.text.includes('2026-12-31'));

  context.notificationSendLineText_(options('REF-90-SEC'));
  const queueText = spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE')
    .values.flat().join('|');
  const log = spreadsheet.getSheetByName('V2_notification_logs');
  const headers = log.values[0];
  const record = rowObject(log, 2);

  assert.ok(headers.includes('queue_id'));
  assert.ok(headers.includes('retry_count'));
  assert.ok(!queueText.includes('must-never-be-stored'));
  assert.ok(!String(record.metadata_json).includes('must-never-be-stored'));
  assert.ok(String(record.metadata_json).includes('[redacted]'));
  assert.ok(String(record.line_user_id).includes('…'));
}


function migrationAndWorkerBoundary() {
  const queueSource = fs.readFileSync(
    path.join(__dirname, '..', 'apps-script', 'V2_NOTIFICATION_QUEUE.js'),
    'utf8'
  );
  assert.ok(queueSource.includes('function processNotificationQueue()'));
  assert.ok(queueSource.includes("everyMinutes(5)"));
  assert.ok(queueSource.includes("runtimeRequireFeature_('NOTIFICATION_QUEUE')"));
  assert.ok(queueSource.includes('runtimeRequireSchemaMigration_()'));
  assert.ok(queueSource.includes("'pending'"));
  assert.ok(queueSource.includes("'processing'"));
  assert.ok(queueSource.includes("'retrying'"));
  assert.ok(queueSource.includes("'failed'"));
  assert.ok(queueSource.includes("'sent'"));
}


scenarioAHealthyLine();
scenarioBFirstFailureRetriesInFiveMinutes();
scenarioCThirdFailureIsTerminal();
scenarioDDuplicateEventDoesNotResend();
scenarioEStaleProcessingRecoversOrFails();
templateAndLogSecurity();
migrationAndWorkerBoundary();

console.log('Phase 90 notification reliability tests: PASS');

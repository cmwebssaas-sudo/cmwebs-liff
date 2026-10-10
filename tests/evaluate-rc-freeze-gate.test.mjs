import assert from 'node:assert/strict'; import {evaluateGate} from '../tools/evaluate-rc-freeze-gate.mjs';
const r=evaluateGate(); assert.equal(r.REMOTE_VERIFICATION,'HUMAN_REQUIRED'); assert.equal(r.RC_FREEZE_READY,'NO'); console.log('gate-evaluator: PASS');

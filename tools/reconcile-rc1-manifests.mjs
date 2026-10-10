import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const manifestDir = path.join(root, 'release-manifests');
const scopePath = path.join(manifestDir, 'cmwebs-v2-rc1-scope-manifest.json');
const classificationPath = path.join(
  manifestDir,
  'cmwebs-v2-rc1-path-classification.json'
);
const shaPath = path.join(manifestDir, 'cmwebs-v2-rc1-sha-manifest.json');

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const sha256 = async file =>
  createHash('sha256').update(await readFile(file)).digest('hex');

const scope = await readJson(scopePath);
const classification = await readJson(classificationPath);
const shaManifest = await readJson(shaPath);
const candidatePaths = [
  ...scope.candidate.backend.map(file => `apps-script/${file}`),
  ...scope.candidate.frontend
].sort();

const candidateSet = new Set(candidatePaths);
const existingByPath = new Map(
  classification.entries.map(entry => [entry.path, entry])
);

const entries = [...existingByPath.values()]
  .filter(entry => !candidateSet.has(entry.path))
  .concat(
    candidatePaths.map(file => ({
      path: file,
      state: existingByPath.get(file)?.state || 'tracked-unchanged',
      classification: 'Production RC candidate'
    }))
  )
  .sort((left, right) => left.path.localeCompare(right.path));

const counts = entries.reduce((result, entry) => {
  result[entry.classification] = (result[entry.classification] || 0) + 1;
  return result;
}, {});

const includedFiles = [];
for (const file of candidatePaths) {
  includedFiles.push({ file, sha256: await sha256(path.join(root, file)) });
}

scope.scope_classification = {
  status: 'RC_ELIGIBLE',
  document: 'docs/123-CONTROLLED-RC-FREEZE-BACKUP-MIGRATION-REHEARSAL.md',
  reconciliation: {
    original_scope_count: 35,
    original_classification_count: 34,
    differing_path: 'apps-script/appsscript.json',
    decision: 'RC_ELIGIBLE',
    evidence: 'Apps Script runtime manifest required by the platform and canonical validator.'
  }
};
classification.generated_at = new Date().toISOString();
classification.counts = counts;
classification.entries = entries;
shaManifest.status = 'reconciled_rc_candidate';
shaManifest.generated_at = new Date().toISOString();
shaManifest.included_files = includedFiles;
shaManifest.excluded_files = scope.excluded.map(file => `apps-script/${file}`);

for (const [file, value] of [
  [scopePath, scope],
  [classificationPath, classification],
  [shaPath, shaManifest]
]) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

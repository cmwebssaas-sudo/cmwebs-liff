import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
// Resolve the same CJS export used by this locked Miniflare instance. No
// dependency files are modified; constructor and disposal belong in run().
export async function withNodeFetchTiming(run){
  const fromMiniflare=createRequire(require.resolve('miniflare'));
  if(require('miniflare/package.json').version!=='5.20261006.1-alpha'||
     fromMiniflare('undici/package.json').version!=='7.29.1')throw Error('FETCH_RUNTIME_UNVERIFIED');
  return withFetchBoundary(fromMiniflare('undici'),run);
}

let active = false;

export async function withFetchBoundary(owner, run, {now = () => performance.now()} = {}) {
  if (active) throw Error('OVERLAP');
  const descriptor = owner && Object.getOwnPropertyDescriptor(owner, 'fetch');
  if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
      typeof descriptor.value !== 'function' || !descriptor.writable || !descriptor.configurable) {
    throw Error('FETCH_OWNER');
  }
  const context = new AsyncLocalStorage();
  const records = new WeakMap();
  let open = true;
  const clock = () => {
    try {
      const value = now();
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch { return null; }
  };
  const recordFor = token => {
    const record = token && records.get(token);
    if (!open || !record) throw Error('TOKEN');
    return record;
  };
  const capability = Object.freeze({
    begin() {
      if (!open) throw Error('TOKEN');
      const token = Object.freeze({});
      records.set(token, {used:false, running:false, unfinished:false, calls:0, settled:0, errors:0, before_ms:null, after_ms:null});
      return token;
    },
    run(token, fn) {
      const record = recordFor(token);
      if (record.used) throw Error('TOKEN');
      record.used = true;
      record.running = true;
      const close = () => {
        record.unfinished = record.calls !== record.settled;
        record.running = false;
      };
      let result;
      try { result = context.run(record, fn); }
      catch (error) { close(); throw error; }
      return Promise.resolve(result).then(
        value => { close(); return value; },
        error => { close(); throw error; }
      );
    },
    sample(token) {
      const record = recordFor(token);
      const {calls, settled, errors, before_ms, after_ms} = record;
      const complete = record.used && !record.running && !record.unfinished && calls === 1 && settled === 1 && before_ms !== null &&
        after_ms !== null && after_ms >= before_ms;
      return {status:complete ? 'COMPLETE' : 'INCOMPLETE', calls, settled, errors, before_ms, after_ms};
    }
  });
  function observedFetch(...args) {
    const record = context.getStore();
    if (!open || !record?.running) return Reflect.apply(descriptor.value, this, args);
    record.calls++;
    const before = clock();
    if (record.calls === 1) record.before_ms = before;
    const finish = failed => {
      record.settled++;
      if (failed) record.errors++;
      const after = clock();
      if (record.calls === 1) record.after_ms = after;
    };
    let result;
    try { result = Reflect.apply(descriptor.value, this, args); }
    catch (error) { finish(true); throw error; }
    return Promise.resolve(result).then(
      value => { finish(false); return value; },
      error => { finish(true); throw error; }
    );
  }
  active = true;
  try {
    Object.defineProperty(owner, 'fetch', {...descriptor, value:observedFetch});
    return await run(capability);
  } finally {
    open = false;
    Object.defineProperty(owner, 'fetch', descriptor);
    context.disable();
    active = false;
  }
}

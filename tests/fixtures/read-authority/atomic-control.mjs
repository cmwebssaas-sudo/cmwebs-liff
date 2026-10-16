// Fake atomic admission for adapter unit tests only; real flock is integration-tested.
const tag=Symbol('synthetic atomic control');
export function atomicFixtureControl(control) {
  if(!control || (typeof control.externalRead==='function' && !control[tag])) return control;
  const wait=control.waitForExternalReadSlot,debit=control.reserveExternalReads;
  return {...control,[tag]:true,externalRead:async io=>{
    await wait(1);await debit(1);return await io();
  }};
}

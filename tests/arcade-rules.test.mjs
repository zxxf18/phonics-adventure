import { test } from 'node:test';
import assert from 'node:assert/strict';
import { railwayDestination, makeEchoSequence, rhythmGrade } from '../app/arcade-rules.ts';
test('rail junction topology has three reachable destinations, upper bypasses lower', () => {
  assert.equal(railwayDestination(true,true),0);
  assert.equal(railwayDestination(true,false),0);
  assert.equal(railwayDestination(false,true),1);
  assert.equal(railwayDestination(false,false),2);
});
test('echo sequence is repeatable for retries, grows with levels, stays in sound bank', () => {
  for(let level=1;level<=4;level++) {
    const a=makeEchoSequence(level,13);
    assert.equal(a.length,level+2);
    assert.deepEqual(a,makeEchoSequence(level,13));
    assert.ok(a.every(x=>x>=0&&x<3));
  }
});
test('rhythm scores actual timing distance including early and late beats', () => {
  for(const sign of [-1,1]) {
    assert.equal(rhythmGrade(180*sign),'perfect');
    assert.equal(rhythmGrade(181*sign),'good');
    assert.equal(rhythmGrade(340*sign),'good');
    assert.equal(rhythmGrade(341*sign),'miss');
  }
});

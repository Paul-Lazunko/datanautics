const assert = require('assert');
const { resolve } = require('path');
const { readFileSync, unlinkSync } = require('fs');

const { Datanautics } = require('../dist');
const { setTimeout } = require('timers');

const dumpPath = resolve(__dirname, './data.json');
const data = { user: { firstname: 'John', lastname: 'Doe' }, score: [27] };

const db = new Datanautics({ dumpPath, dumpInterval: 0 });

assert.equal(db.set('user.firstname', data.user.firstname), true);
assert.equal(db.set('user.lastname', data.user.lastname), true);
assert.equal(db.set('score[0]', data.score[0]), true);

setTimeout(() => {
  const storedData = readFileSync(dumpPath).toString();
  assert.equal(storedData, JSON.stringify(data, null, 2));
  unlinkSync(dumpPath);
  console.log('tests passed');
  process.exit(0)
});

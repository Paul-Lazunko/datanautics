const assert = require('assert');
const { resolve } = require('path');
const { readFileSync, unlinkSync } = require('fs');

const { Datanautics } = require('../dist');
const { setTimeout } = require('timers');

const dumpPath = resolve(__dirname, './data.txt');
const data = { user: { firstname: 'John', lastname: 'Doe' }, score: [27] };

const db = new Datanautics({ dumpPath, dumpInterval: 100 });

assert.equal(db.set('user.firstname', data.user.firstname), true);
assert.equal(db.set('user.lastname', data.user.lastname), true);
assert.equal(db.set('score[0]', data.score[0]), true);

assert.equal(db.get('user.firstname'), data.user.firstname);
assert.equal(db.get('user.lastname'), data.user.lastname);
assert.equal(db.get('score[0]'), data.score[0]);

setTimeout(() => {
  // const storedData = readFileSync(dumpPath).toString();
  // assert.equal(storedData, JSON.stringify(data, null, 2));
  // unlinkSync(dumpPath);
  console.log('tests passed');
  process.exit(0);
}, 1000);

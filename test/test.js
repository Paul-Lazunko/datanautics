const assert = require('assert');
const { resolve } = require('path');
const { readFileSync, unlinkSync } = require('fs');

const { Datanautics } = require('../dist');
const { setTimeout } = require('timers');

const dumpPath = resolve(__dirname, './data.txt');
const data = { user: { firstname: 'John', lastname: 'Doe' }, score: [27] };

const writer = new Datanautics({ dumpPath, writer: true });
const reader = new Datanautics({ dumpPath, writer: false });

assert.equal(writer.set('user.firstname', data.user.firstname), true);
assert.equal(writer.set('user.lastname', data.user.lastname), true);
assert.equal(writer.set('score[0]', data.score[0]), true);

assert.equal(writer.get('user.firstname'), data.user.firstname);
assert.equal(writer.get('user.lastname'), data.user.lastname);
assert.equal(writer.get('score[0]'), data.score[0]);

setTimeout(() => {

  assert.equal(reader.get('user.firstname'), data.user.firstname);
  assert.equal(reader.get('user.lastname'), data.user.lastname);
  assert.equal(reader.get('score[0]'), data.score[0]);
  console.log('tests passed');
  process.exit(0);
}, 2000);

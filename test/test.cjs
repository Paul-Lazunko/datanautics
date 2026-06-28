const assert = require('assert');
const { resolve } = require('path');

const { Datanautics } = require('../dist');
const { createWriteStream, createReadStream } = require('fs');

const pathToDumpFile = resolve(__dirname, './data.txt');

const writeStream = createWriteStream(pathToDumpFile, {
  flags: 'w',
  encoding: 'utf8',
  autoClose: true,
});

const readStream = createReadStream(pathToDumpFile, { encoding: 'utf8' });

const data = {
  user: { firstname: 'John Junior Frost 11', lastname: 'Doe' },
  score: [27],
  nested: { key: BigInt('1000000000000000000000') },
  j: [
    1,
    2,
    2,
  ],
  kk: [],
};
async function main() {
  const writer = new Datanautics({ pathToDumpFile, writer: true, verbose: true });
  await writer.init(readStream);
  assert.equal(writer.set('user.firstname', data.user.firstname), true);
  assert.equal(writer.set('user.lastname', data.user.lastname), true);
  assert.equal(writer.set('score[0]', data.score[0]), true);
  assert.equal(writer.set('nested', data.nested), true);
  assert.equal(writer.set('j', data.j), true);
  assert.equal(writer.set('kk', data.kk), true);
  await writer.store(writeStream);
  assert.equal(writer.set('user.firstname', data.user.firstname), true);
  assert.equal(writer.set('user.lastname', data.user.lastname), true);
  assert.equal(writer.set('score[0]', data.score[0]), true);
  assert.equal(writer.set('nested', data.nested), true);
  assert.equal(writer.set('j', data.j), true);
  assert.equal(writer.set('kk', data.kk), true);
  assert.equal(writer.get('user.firstname'), data.user.firstname);
  assert.equal(writer.get('user.lastname'), data.user.lastname);
  assert.equal(writer.get('score[0]'), data.score[0]);
  assert.equal(writer.get('kk'), data.kk);
  console.log('OK');
  process.exit(0);
}

main().catch(console.error);

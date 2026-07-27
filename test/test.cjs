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
  user: { firstname: 'John Junior Frost 11', lastname: 'Doe', birthday: new Date().toISOString() },
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
  const dataStore = new Datanautics({ verbose: true });
  await dataStore.init(readStream);
  assert.equal(dataStore.set('user.firstname', data.user.firstname), true);
  assert.equal(dataStore.set('user.birthday', data.user.birthday), true);
  assert.equal(dataStore.set(data.user.birthday, 123), true);
  assert.equal(dataStore.set('user.lastname', data.user.lastname), true);
  assert.equal(dataStore.set('score[0]', data.score[0]), true);
  assert.equal(dataStore.set('nested', data.nested), true);
  assert.equal(dataStore.set('j', data.j), true);
  assert.equal(dataStore.set('kk', data.kk), true);
  await dataStore.store(writeStream);
  assert.equal(dataStore.set('user.firstname', data.user.firstname), true);
  assert.equal(dataStore.set('user.lastname', data.user.lastname), true);
  assert.equal(dataStore.set('score[0]', data.score[0]), true);
  assert.equal(dataStore.set('nested', data.nested), true);
  assert.equal(dataStore.set('j', data.j), true);
  assert.equal(dataStore.set('kk', data.kk), true);
  assert.equal(dataStore.get('user.firstname'), data.user.firstname);
  assert.equal(dataStore.get('user.lastname'), data.user.lastname);
  assert.equal(dataStore.get('user.birthday'), data.user.birthday);
  assert.equal(dataStore.get(data.user.birthday), 123);
  assert.equal(dataStore.get('score[0]'), data.score[0]);
  assert.equal(dataStore.get('kk'), data.kk);
  console.log('OK');
  process.exit(0);
}

main().catch(console.error);

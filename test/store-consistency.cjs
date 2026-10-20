// Run with: node --expose-gc test/store-consistency.cjs
const assert = require('assert');
const { resolve } = require('path');
const { createWriteStream, createReadStream, writeFileSync, readFileSync, unlinkSync } = require('fs');

const { Datanautics } = require('../dist');

const dumpFile = resolve(__dirname, './store-consistency.txt');

async function dump(store) {
  await store.store(createWriteStream(dumpFile, { flags: 'w', encoding: 'utf8' }));
  return readFileSync(dumpFile, 'utf8');
}

async function load() {
  const store = new Datanautics({});
  await store.init(createReadStream(dumpFile, { encoding: 'utf8' }));
  return store;
}

function heapMb() {
  global.gc();
  return process.memoryUsage().heapUsed / 1048576;
}

async function overwrittenSubtreeIsNotResurrected() {
  const store = new Datanautics({});
  store.set('db.app', { users: { id1: 'alice', id2: 'bob' } }, 10);
  store.set('db.app', { users: { id1: 'alice' } }, 20);
  const text = await dump(store);
  assert.ok(!text.includes('id2'), 'overwritten key must not be dumped');
  const restored = await load();
  assert.deepStrictEqual(restored.get('db'), { app: { users: { id1: 'alice' } } });
}

async function deleteKeepsTombstoneOnly() {
  const store = new Datanautics({});
  store.set('db.keep', { a: 1 }, 10);
  store.set('db.old', { x: { a: 1 } }, 10);
  assert.strictEqual(store.set('db.old', undefined, 30), true);
  assert.strictEqual(store.get('db.old'), undefined);
  assert.strictEqual(store.getTimestamp('db.old'), 30);
  assert.strictEqual(store.getTimestamp('db.old.x.a'), 30);
  const text = await dump(store);
  assert.deepStrictEqual(text.trim().split('\n'), [
    '30 db.old undefined',
    '10 db.keep.a 1',
  ]);
  const restored = await load();
  assert.deepStrictEqual(restored.get('db'), { keep: { a: 1 } });
  assert.strictEqual(restored.getTimestamp('db.old'), 30);
  // delete of a missing path must not create empty parents
  restored.delete('ghost.a.b', 40);
  assert.strictEqual(restored.get('ghost'), undefined);
}

async function legacyDumpIsRead() {
  // Shape written by <= 9.2.0 after store.set('db.old', undefined).
  writeFileSync(
    dumpFile,
    [
      '1 db ␣{}␣',
      '1 db.keep.a 1',
      '1 db.old.x.a 1',
      '2 db.old undefined',
      'k v',
      '',
    ].join('\n'),
  );
  const restored = await load();
  assert.deepStrictEqual(restored.get('db'), { keep: { a: 1 } });
  assert.strictEqual(restored.get('k'), 'v');
  assert.strictEqual(restored.getTimestamp('db.keep.a'), 1);
  assert.strictEqual(restored.getTimestamp('db.old'), 2);
  assert.strictEqual(restored.getTimestamp('k'), undefined);
}

async function valuesRoundTrip() {
  const store = new Datanautics({});
  const birthday = new Date().toISOString();
  store.set('user.name', 'John Junior Frost 11');
  store.set('user.word', 'falsehood');
  store.set('user.flag', false);
  store.set(`dates.${birthday}`, 123);
  store.set('big', BigInt('1000000000000000000000'));
  store.set('list', [
    1,
    2.5,
    'x y',
  ]);
  store.set('empty', { arr: [], obj: {} });
  await dump(store);
  const restored = await load();
  assert.strictEqual(restored.get('user.name'), 'John Junior Frost 11');
  assert.strictEqual(restored.get('user.word'), 'falsehood');
  assert.strictEqual(restored.get('user.flag'), false);
  assert.strictEqual(restored.get(`dates.${birthday}`), 123);
  assert.strictEqual(restored.get('big'), BigInt('1000000000000000000000'));
  assert.deepStrictEqual(restored.get('list'), [
    1,
    2.5,
    'x y',
  ]);
  assert.deepStrictEqual(restored.get('empty'), { arr: [], obj: {} });
}

async function numericLookingKeysSurviveRestoreAndStore() {
  // PropertyAccessor.set turns these parents into arrays; every key must still be dumped.
  const lines = [
    '1 db.app.ids.000000000000000000000001 alice',
    '1 db.app.ids.000000000000000000000002 bob',
    '1 db.app.byNumber.42 ␣["id1"]␣',
    '1 db.app.byNumber.1792490047513 ␣["id2"]␣',
    '',
  ];
  writeFileSync(dumpFile, lines.join('\n'));
  const before = JSON.stringify(Object.entries((await load()).get('db.app.ids')));
  const once = await load();
  await dump(once);
  const twice = await load();
  assert.strictEqual(JSON.stringify(Object.entries(twice.get('db.app.ids'))), before);
  assert.strictEqual(twice.get('db.app.ids.000000000000000000000002'), 'bob');
  assert.deepStrictEqual(twice.get('db.app.byNumber.42'), ['id1']);
  assert.deepStrictEqual(twice.get('db.app.byNumber.1792490047513'), ['id2']);
}

async function timestampsSurviveDumpAndRestore() {
  const store = new Datanautics({});
  store.set('db.app', { users: { id1: 'alice', id2: 'bob' }, meta: { v: 1 } }, 100);
  store.set('db.app.users.id2', 'bobby', 150);
  store.set('db.other.x', 1, 120);
  store.delete('db.app.users.id3', 160);
  const expected = {
    'db.app': 160,
    'db.app.users.id1': 100,
    'db.app.users.id2': 150,
    'db.app.users.id3': 160,
    'db.app.meta.v': 100,
    'db.other': 120,
  };
  for (const [
    key,
    ts,
  ] of Object.entries(expected)) {
    assert.strictEqual(store.getTimestamp(key), ts, `before dump: ${key}`);
  }
  await dump(store);
  const restored = await load();
  for (const [
    key,
    ts,
  ] of Object.entries(expected)) {
    assert.strictEqual(restored.getTimestamp(key), ts, `after restore: ${key}`);
  }
  // compacted back to one stamp per write, not one per leaf
  assert.strictEqual(restored.timestamps.db.app.meta, undefined);
}

async function lastWriterWins() {
  const a = new Datanautics({});
  const b = new Datanautics({});
  // A changes at 19 and sends it to B; B already changed the same key at 20.
  a.set('db.app.users.id1', 'from A', 19);
  b.set('db.app.users.id1', 'from B', 20);
  assert.strictEqual(b.setIfNewer('db.app.users.id1', 'from A', 19), false, 'B keeps its newer write');
  // B replies with its own update; A accepts it.
  const reply = { key: 'db.app.users.id1', value: b.get('db.app.users.id1'), ts: b.getTimestamp('db.app.users.id1') };
  assert.strictEqual(a.setIfNewer(reply.key, reply.value, reply.ts), true);
  assert.strictEqual(a.get('db.app.users.id1'), 'from B');
  // equal timestamps are not applied: the caller needs a tie-breaker (e.g. node id)
  assert.strictEqual(a.setIfNewer('db.app.users.id1', 'tie', 20), false);

  // an older write below a newer whole-subtree write is rejected, and vice versa
  b.set('db.app', { users: {} }, 30);
  assert.strictEqual(b.setIfNewer('db.app.users.id9', 'late', 25), false);
  b.set('db.app.users.id9', 'new', 40);
  assert.strictEqual(b.setIfNewer('db.app', { users: {} }, 35), false, 'would drop a newer descendant');

  // deletes win over older writes, also after purge they no longer do
  b.delete('db.app.users.id9', 50);
  assert.strictEqual(b.setIfNewer('db.app.users.id9', 'stale', 45), false);
  assert.strictEqual(b.purgeTombstones(51), 1);
  assert.strictEqual(b.setIfNewer('db.app.users.id9', 'stale', 45), true);
  assert.strictEqual(b.deleteIfNewer('db.app.users.id9', 44), false);
  assert.strictEqual(b.deleteIfNewer('db.app.users.id9', 60), true);
  assert.strictEqual(b.get('db.app.users.id9'), undefined);
}

async function memoryDoesNotGrowWithChurn() {
  const docs = 20000;
  const generation = (g) => {
    const users = {};
    for (let i = 0; i < docs; i++) {
      users[(g * docs + i).toString(16).padStart(24, '0')] = `user_${i % 1000}`;
    }
    return { users };
  };
  const store = new Datanautics({});
  store.set('db.app', generation(0));
  await dump(store);
  const first = heapMb();
  for (let g = 1; g <= 5; g++) {
    store.set('db.app', generation(g));
    await dump(store);
  }
  const last = heapMb();
  assert.ok(last - first < 2, `heap grew by ${(last - first).toFixed(1)} MB across 5 dumps with constant live data`);
  const lines = readFileSync(dumpFile, 'utf8').trim().split('\n').length;
  assert.strictEqual(lines, docs);
}

async function main() {
  assert.ok(typeof global.gc === 'function', 'run with --expose-gc');
  await overwrittenSubtreeIsNotResurrected();
  await deleteKeepsTombstoneOnly();
  await legacyDumpIsRead();
  await valuesRoundTrip();
  await numericLookingKeysSurviveRestoreAndStore();
  await timestampsSurviveDumpAndRestore();
  await lastWriterWins();
  await memoryDoesNotGrowWithChurn();
  unlinkSync(dumpFile);
  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

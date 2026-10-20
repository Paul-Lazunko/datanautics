# Datanautics

**Datanautics** is a lightweight key-value storage system with support for nested property access and persistent dumps to disk.

It uses string-based paths (like `user[0].profile.name`) to **get/set deeply nested data**, and saves the current state to the dump file for durability.

---

## Features

- Dot/bracket notation access (`a.b[0]['call me as u wish']`)
- Persistent JSON file storage (auto-saves at configurable intervals)
- Configurable verbosity and custom logger
- Simple API: `.get(key)`, `.set(key, value)`
- Built on top of [`property-accessor`](https://npmjs.com/package/property-accessor)

---

## Installation

```bash
npm install datanautics
```

---

## Usage

```ts
const { Datanautics } = require('datanautics');

const storage = new Datanautics({
  verbose: true,
  logger: console,
});

const readStream = createReadStream('/path/to/file', { encoding: 'utf8' });

await storage.init(readStream);

storage.set('users[0].name', 'Alice');
console.log(storage.get('users[0].name')); // Output: Alice

const writeStream = createWriteStream('/path/to/file');

await storage.store(writeStream);
```

---

## Configuration Options

You can pass the following options to the constructor:

| Option    | Type                | Description                                | Default   |
| --------- | ------------------- | ------------------------------------------ | --------- |
| `verbose` | `boolean`, optional | Log errors during reading/writing          | `true`    |
| `logger`  | `object`, optional  | Custom logger (`console`, `winston`, etc.) | `console` |

---

## Methods

### `init(stream: ReadStream): Promise<void>`

Initializes the instance and restores your data from the provided ReadStream.

### `set(key: string, value: any, timestamp?: number): boolean`

Sets a value using a path-based key, replacing everything that was under it. The write is stamped with
`timestamp` (default: `Date.now()`); nested keys inherit it.

Setting `undefined` is the same as `delete(key, timestamp)`.

Returns `true` on success, `false` if the key is invalid.

### `delete(key: string, timestamp?: number): boolean`

Removes the key and everything nested under it, and keeps a tombstone stamped with `timestamp`
(default: `Date.now()`) so an older write from another node can be rejected later.

### `getTimestamp(key: string): number | undefined`

Time of the latest write or delete affecting the key: on the key itself, on the closest ancestor that was
written as a whole, or on anything nested under it. `undefined` if the key was never written.

### `setIfNewer(key: string, value: any, timestamp: number): boolean`

### `deleteIfNewer(key: string, timestamp: number): boolean`

Apply the change only if `timestamp` is newer than `getTimestamp(key)`. Return `false` when the local state
is newer or equal; equal timestamps are never applied, so use a tie-breaker (e.g. a node id) when two
nodes can write at the same millisecond.

```ts
// server B receives an update from server A
if (!storage.setIfNewer(key, value, ts)) {
  reply({ key, value: storage.get(key), ts: storage.getTimestamp(key) });
}
```

### `purgeTombstones(before: number): number`

Forgets tombstones older than `before` and returns how many were removed. Call it once every node has seen
those deletes; after that an older write for a purged key is accepted again.

### `get(key: string): any`

Retrieves the value at the specified path.

Returns `undefined` if the path does not exist or is non-evaluable.

### `store(stream: WriteStream): Promise<void>`

Persists data by piping it into the provided WriteStream.
The dump is generated from the current data at call time, so overwritten keys are not written.
Every line carries the time its value was written; tombstones are written as `<timestamp> <key> undefined`.
This method handles the streaming operation and resolves once the data has been fully written.

---

## Requirements

- Node.js 18+

---

## [License](./LICENSE) MIT

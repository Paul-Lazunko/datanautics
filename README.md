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

const store = new Datanautics({
  dumpPath: './data.json',
  verbose: true,
  logger: console,
});

await store.init();

store.set('users[0].name', 'Alice');
console.log(store.get('users[0].name')); // Output: Alice
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

### `set(key: string, value: any): boolean`

Sets a value in the internal store using a path-based key.

Returns `true` on success, `false` if the key is invalid.

### `get(key: string): any`

Retrieves the value at the specified path.

Returns `undefined` if the path does not exist or is non-evaluable.

### `store(stream: WriteStream): Promise<void>`

Persists data by piping it into the provided WriteStream.
This method handles the streaming operation and resolves once the data has been fully written.

---

## Requirements

- Node.js 18+

---

## Dependencies

- [`property-accessor`](https://npmjs.com/package/property-accessor) – Used for safe deep get/set operations

---

## [License](./LICENSE) MIT

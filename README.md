# Datanautics

**Datanautics** is a lightweight key-value storage system with support for nested property access, persistent dumps to disk, and configurable autosave intervals.

It uses string-based paths (like `user[0].profile.name`) to **get/set deeply nested data**, and periodically saves the current state to a JSON file for durability.

---

## ✨ Features

- Dot/bracket notation access (`a.b[0]['c']`)
- Persistent JSON file storage (auto-saves at configurable intervals)
- Configurable verbosity and custom logger
- Simple API: `.get(key)`, `.set(key, value)`
- Built on top of [`property-accessor`](https://npmjs.com/package/property-accessor)

---

## 📦 Installation

```bash
npm install datanautics
```

---

## 🛠 Usage

```ts
const { Datanautics } = require('datanautics');

const store = new Datanautics({
  dumpPath: './data.json',
  dumpInterval: 1000, // every 1 second
  verbose: true,
  logger: console,
});

store.set('users[0].name', 'Alice');
console.log(store.get('users[0].name')); // Output: Alice
```

---

## ⚙️ Configuration Options

You can pass the following options to the constructor:

| Option         | Type                | Description                                       | Default                                   |
| -------------- | ------------------- | ------------------------------------------------- | ----------------------------------------- |
| `dumpPath`     | `string`, optional  | Path to the JSON file for persistent data storage | `node_modules/datanautics/data/data.json` |
| `dumpInterval` | `number`, optional  | Interval in milliseconds between auto-dumps       | `1000` (1 second)                         |
| `verbose`      | `boolean`, optional | Log errors during reading/writing                 | `false`                                   |
| `logger`       | `object`, optional  | Custom logger (`console`, `winston`, etc.)        | `console`                                 |

---

## 🔧 Methods

### `set(key: string, value: any): boolean`

Sets a value in the internal store using a path-based key.

Returns `true` on success, `false` if the key is invalid.

### `get(key: string): any`

Retrieves the value at the specified path.

Returns `undefined` if the path does not exist or is non-evaluable.

---

## 📂 Auto-Save Mechanism

- A background event loop triggers a dump to `options.dumpPath` every `options.dumpInterval` ms.
- All data is saved as a JSON file, preserving nested structures.
- On startup, the class will attempt to read and restore previous data from the file.

---

## ✅ Requirements

- Node.js 14+

---

## 📚 Dependencies

- [`property-accessor`](https://npmjs.com/package/property-accessor) – Used for safe deep get/set operations

---

## 📄 [License](./LICENSE) MIT

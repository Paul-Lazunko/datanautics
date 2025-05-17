# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [2.2.1] - 2025-05-17

### Fixed

- Refactor the data storing avoiding async functionality

---
## [2.2.0] - 2025-05-17

### Fixed

- Upgraded data storing functionality

---

## [2.1.1] - 2025-05-17

### Fixed

- Fixed events intersection and processes overflow

---

## [2.1.0] - 2025-05-17 (**Breaking changes!**)

### Fixed

- Reverted changes since 2.0.0 failed

---

## [2.0.0] - 2025-05-17 (**Breaking changes!**)

### Added

- Instead of background storing entire object store each key-value eventually
- Replaced dumpInterval from options

---

## [1.1.2] - 2025-05-17

### Fixed

- Non-blocking storing

---

## [1.1.1] - 2025-05-17

### Fixed

- Replaced fs usage with child_process

---

## [1.1.0] - 2025-05-17

### Fixed

- Fixed storing to avoid RangeError when JSON.parse/JSON.stringify

---

## [1.0.0] - 2025-05-02

### Added

Basic package implementation

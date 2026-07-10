# 03 — Architecture & Patterns

The judgment module. Order:

1. [01-boundaries-and-layers.md](01-boundaries-and-layers.md)
2. [02-data-model-and-persistence.md](02-data-model-and-persistence.md)
3. [03-validation-auth-and-permissions.md](03-validation-auth-and-permissions.md)
4. [04-side-effects-async-and-reliability.md](04-side-effects-async-and-reliability.md)
5. [05-pattern-catalog.md](05-pattern-catalog.md) — 14 recognition cards
6. [06-architecture-critique.md](06-architecture-critique.md) — doubles as system-design interview prep

Vocabulary you'll leave with (all interview words): **boundary** (where dependencies may only point one way), **contract** (a shape someone else relies on), **invariant** (a condition that must always hold), **idempotency** (repeat = once), **consistency** (all replicas agree eventually or always), **ownership** (which module is allowed to change a piece of state), **blast radius** (how far a change can break things).

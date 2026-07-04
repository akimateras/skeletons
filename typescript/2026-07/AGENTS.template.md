# Agent Guidelines

Architecture rules for this TypeScript project. Full rationale: `DEVELOPMENT.md`. Rules are mechanically enforced by ESLint (`eslint.config.ts`, custom rules in `eslint-rules/`) and dependency-cruiser (`.dependency-cruiser.cjs`) — those files are the source of truth for enforcement.

## Environment

- TypeScript 5.8+, `target: es2025`, `module: esnext`, `moduleResolution: bundler`. tsc is typecheck-only (`noEmit`).
- Required tsconfig flags: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`.
- Zod 4 for runtime validation. Zod is treated as a quasi-standard library: its schema **definitions** may live anywhere the dependency rules allow (including `model/`), because `parse` is pure. No other external library gets this exemption. Validating raw external data (`.safeParse()`) still happens only at boundaries (`app/`, `adapters/`, `config/`).

## Project structure

```text
src/
  modules/<module-name>/
    model/        # core concepts, invariants, state transitions, pure logic
    operations/   # use cases; call model, use ports for I/O; authorization lives here
    ports/        # interfaces for external capabilities the module needs
    adapters/     # concrete implementations of ports (DB, HTTP, SDKs)
    type-guards/  # exception area: explicit type predicates only
    index.ts      # the module's only public entry point
    README.md
  shared/         # cross-module generics only: model/ type-guards/ utils/ errors/ validation/
  unsafe/         # exception area: generic type utilities that patch TS limitations
  app/            # entry points: http/ jobs/ cli/ workers/ — thin, no business rules
  config/         # env/config loading + validation; only place that reads process.env
  main.ts         # composition root: the ONLY place that instantiates and wires adapters
```

Use only these directory names. Omit directories a module doesn't need. Modules are split by business concept (`billing`, `account`), never by technical layer (`controllers`, `services`, `types`).

## Dependency rules

Each area may depend only on the areas listed (enforced by dependency-cruiser):

```text
main.ts    -> config, app, modules/*/{operations,adapters,ports}, shared, unsafe   # adapter instantiation only here
app        -> modules/*/{operations,model,ports,type-guards}, shared, config, unsafe
operations -> model, ports, type-guards (same module), shared, unsafe
adapters   -> ports, model, type-guards (same module), shared, unsafe
ports      -> model (same module), shared, unsafe
type-guards-> model (same module), shared, unsafe
model      -> type-guards (same module), shared, unsafe
shared     -> unsafe (shared/type-guards -> shared/model, unsafe)
config     -> shared, unsafe
unsafe     -> NOTHING (no internal areas, no npm packages, no Node built-ins)
```

- **Cross-module**: only `operations/` (plus `app/` and `main.ts`) may import other modules, always via the target module's `index.ts`. Modules must form a DAG — no cycles. Shared IDs/value objects go in `shared/model` (shared kernel: pure types/values, no business logic).
- **External packages**: pure areas (`model`, `operations`, `ports`, `type-guards`, `shared`) may import **Zod only** — no other packages, no Node built-ins. Boundary areas (`app`, `config`, `adapters`, `main.ts`) may use external packages. Test files may additionally import vitest.
- Never import a module's internals from outside; use `index.ts` with explicit extension (`import { x } from "../billing/index.ts"`). Never re-export `adapters/` from `index.ts`.

## Forbidden type-escape constructs

TypeScript's design makes it easy to write code that silently breaks the type system. To prevent this, the following are banned project-wide (tests included — no relaxation for test files):

- explicit `any`; unsafe assignment/argument/call/member-access/return
- `as` assertions (exception: `as const`); `<T>value` assertions
- non-null assertion `!`; definite assignment assertion (`x!: T`); class field `declare` modifier
- type predicates `value is T` and assertion functions `asserts value is T`
- function/method overload signatures
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`; ESLint disable comments
- ambient declarations (`declare const/function/class/module/global/namespace`); `.d.ts` files (banned everywhere, including `unsafe/`)
- `null` type and value

Exception areas (use only for the stated purpose):

1. `type-guards/` (module-level and `shared/type-guards/`): explicit predicates `value is T` only. Assertion functions still banned. Functions must be pure; never use them to validate external input (use Zod schemas instead). Prefer, in order: (1) type design that removes the need, (2) normal functions narrowed by inference, (3) runtime schema, (4) explicit guard here.
2. `unsafe/`: assertions, type-level `any`, ambient value declarations, and overloads allowed **only to define generic type utilities** (brand helpers, strict object types, type-level transforms). Never business rules, module-specific types, I/O, or side-effect reads (`Date.now()`, `Math.random()`, `fetch`, `console`). **Never export a function returning a stronger type claim than it verified at runtime** — e.g. `parseAs<T>(text): T`, `definitely<T>(v: T | undefined): T`, or any cast where the caller picks a return-only type parameter. That is `as` re-exported as a function. No module-specific `unsafe/` directories.
3. `adapters/`: `null` type/value allowed only to express external contracts (DB NULL, JSON null). Never leaks into ports or beyond.

Fix type errors by fixing types, validation, branching, or boundaries — never by introducing an escape hatch.

## Type & schema rules

- **`satisfies` instead of `as`** to check conformance while keeping inference: `const config = {...} satisfies RetryConfig;`
- **Validate all external input at runtime** (HTTP body/query/params/headers, webhooks, env, API responses, DB rows, JSON, queue messages). Receive as `unknown`, validate with a Zod schema before passing inward. **Standard is `.safeParse()`**; invalid input is an expected failure → result type or 400-style response, never a throw. Sole exception: `config/` startup validation may `.parse()` and fail fast.
- **`undefined`, never `null`**, for absent values. Convert at the boundary: `z.string().nullable().transform((v) => v ?? undefined)`. Sending `null` to external systems happens only inside `adapters/`.
- **Brand IDs/amounts/dates** — don't spread raw `string`/`number`. `Brand<T, B>` and the single `as`-containing `brand()` helper live in `unsafe/`. Don't use Zod `.brand()`. Call `brand()` only in boundary validation transforms or in `model/` smart constructors:

  ```ts
  const CustomerId = z.uuid().transform((s) => brand<string, "CustomerId">(s));
  ```

- **Schema placement**: colocate schemas with what they validate — no central `schemas/` directory. Use-case input schemas live in `operations/` (exported via `index.ts`; `app/` just imports and `.safeParse`s). External wire shapes (API responses, DB rows) live in `adapters/`. Put a schema in `model/` **only** when 2+ boundaries share the same domain validation (value objects like `Money`, cross-boundary enums). Env/config in `config/`; generic business-agnostic fields in `shared/validation/`. Derive types via `z.infer` for a single source of truth.
- **`interface` only for `ports/`** (contracts that adapters implement, composed with `extends`); everything else uses `type`. Never rely on declaration merging.
- **Function members use property syntax**, everywhere (interfaces, type literals, abstract class members): `save: (invoice: Invoice) => Promise<void>;` — method syntax is checked bivariantly and lets adapters implement narrower contracts than the port declares. Concrete class method implementations are exempt.
- **Unions, not `enum`** (`enum` emits runtime code and is banned by `erasableSyntaxOnly`):

  ```ts
  export const SubscriptionStatus = z.enum(["active", "canceled", "past_due"]);
  export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;
  // or: type Direction = "up" | "down";  /  const XS = [...] as const; type X = (typeof XS)[number];
  ```

- **Preserve readonly**: never assign a readonly-typed value to a mutable-typed variable/param/return (TS allows it; enforced by custom rule `local/no-readonly-to-mutable`). Need mutation → make an explicit copy.

## Side effects

- Never read time, randomness, env, or perform I/O implicitly inside pure areas. Pass values in (`issuedAt: Date`) or inject capabilities via `deps` typed as `ports/` interfaces:

  ```ts
  export async function createInvoice(
    input: CreateInvoiceInput,
    deps: { invoiceRepository: InvoiceRepository; clock: Clock },
  ): Promise<CreateInvoiceResult> { /* ... */ }
  ```

- Only `main.ts` (and its wiring code) instantiates adapters and injects them.
- Transaction boundaries are explicit: a Unit-of-Work port or an injected transaction runner (`deps.transaction(async (tx) => ...)`). `operations/` declares the boundary; never depends on a concrete DB transaction API.

## Error design

- **Expected business failures return tagged unions** with literal `reason` values (exhaustive `switch` works):

  ```ts
  export type RegisterUserResult =
    | { ok: true; userId: UserId }
    | { ok: false; reason: "EMAIL_ALREADY_USED" | "INVALID_EMAIL" };
  ```

- **Exceptions only for unexpected faults** (bugs, unrecoverable system errors); caught at `app/` for logging/response mapping.
- Never compare error message strings; use codes/tags.
- **Port failure contracts**: business-possible failures (payment declined, conflict, not-found) are in the port's return type; adapters convert SDK exceptions into them. Only unexpected faults may throw, propagating to `app/`. The port definition decides the classification; adapters must not diverge.

## Testing

- Colocate tests: `<file>.test.ts` next to the source; type tests `<file>.test-d.ts`. No `tests/` directory. `npm run test` runs both.
- `model/`: fast pure unit tests for rules/calculations/transitions.
- `operations/`: inject test implementations of ports (fully implementing the interface). Cover: success, business failures, authorization denial, invalid input, dependency failure, idempotent re-execution, transaction rollback.
- `adapters/`: verify they satisfy the port contract; keep I/O-dependent tests separate from unit tests.
- `type-guards/`: exhaustive — accepted values, rejected values, boundary values, structurally-similar values.
- `unsafe/`: type tests verifying inference works, wrong types are rejected, and nothing becomes an `unknown`→any-type escape hatch.
- Tests follow the same type rules as production code — no `as` mocks (use factories + `satisfies`), no `!` (branch on `undefined` and fail the test).
- Keep regression tests for important specs and past bugs.

## Boundaries

- `app/` handlers only: extract input, validate, extract auth info, call `operations/`, map result to response. No business rules.
- Authorization decisions live in `operations/` (returned as `{ ok: false, reason: "FORBIDDEN" }`), not in `app/`.
- DB/ORM/external-SDK types never leak into `model/` or `operations/`; adapters validate and convert.
- `process.env` is read only in `config/`.
- Event/message payloads carry version info; receivers tolerate unknown fields, senders avoid removing/repurposing required fields.

## Naming & files

- Avoid `manager/helper/common/util/service/processor/handler` names (exception: "HTTP handler" as the `app/http/` entry role).
- Operations start with a verb (`createInvoice`); type names express concepts, not structure (no `Data`/`Payload`/`Info`).
- Keep files single-responsibility and small; state transitions go through dedicated functions that reject invalid transitions.
- Source extensions: `.ts` only (`.mts`/`.cts` if required). `.tsx`/`.jsx`/`.js` under `src/` are banned.

## Agent workflow

1. Before editing, decide which area the change belongs to; follow nearby existing code when ambiguous.
2. Never bypass type errors with escape hatches (see forbidden list).
3. Minimize cross-module changes; go through public entry points.
4. Don't abstract prematurely. Deduplicate only shared business rules or shared external contracts — not coincidental similarity.
5. No unrelated renames, reformatting, moves, or "drive-by improvements".
6. Behavior changes require test additions/updates (or a recorded manual verification procedure).
7. **Never modify `eslint.config.ts`, `eslint-rules/`, `.dependency-cruiser.cjs`, or `tsconfig.json`** — they encode this architecture. Fix the code, not the guardrails.
8. Run `npm run check` (typecheck + lint + lint:deps + test) before declaring any change complete. Report failures as failures — never as done.

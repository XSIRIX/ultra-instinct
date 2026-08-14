---
name: tdd
description: Use when implementing any feature, bugfix, or behavior change — write the test first, watch it fail, then write the code that makes it pass. Covers the red-green-refactor cycle and what separates an honest test from a decorative one.
---

# Test-Driven Development

Write the test. Watch it fail. Write the code that makes it pass.

**Why the failure matters:** a test you never watched fail hasn't proven it can catch anything. It might assert on the wrong thing, test a mock instead of your code, or pass for a reason you didn't intend. Red is the proof.

## Ground the contract

Direct entry into TDD must not bypass current evidence. Before production code touches a library, framework, platform API, or unfamiliar error:

- Search the repository for its established pattern.
- Check the pinned version.
- Reuse current references from debugging, the spec, or the plan.
- If those references are missing, stale, or contradicted, run one bounded web search or Exa pass against official version-matched docs or source.

Purely internal behavior needs no web search. Search again only when the contract changes or a fix fails; then return to `systematic-debugging` rather than stacking fixes.

## The cycle

**Red** — one test, one behavior, a name that says what should happen, real code over mocks.

**Verify red** — run it. It should *fail*, not error; the message should be the one you expected; and it should fail because the behavior is missing, not because the test is broken. If it passes immediately, you're testing something that already exists — rewrite it.

**Green** — the simplest code that passes. No extra options, no anticipated parameters, no "while I'm in here."

**Verify green** — run it again. New test passes, suite still passes, output clean. If it fails, fix the code, not the test.

**Refactor** — only once green. Remove duplication, improve names, extract helpers. Stay green; new behavior needs its own red test.

## What an honest test looks like

```typescript
test('retries a failing operation three times before succeeding', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

And what a decorative one looks like:

```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(2);   // asserts the mock, not your code
});
```

**The question that separates them:** what change to the production code would make this test fail? If you can't name one, the test isn't testing anything.

## A test is worth keeping when

- It covers one behavior. An "and" in the name usually means two tests.
- It asserts on real behavior, not on mocks. `expect(mock).toHaveBeenCalled()` proves you called your own mock.
- Its mocks are only the things you truly can't run — network, clock, filesystem, paid APIs. Every other mock is a chance to test a fiction. If you can't test without mocking everything, the code is too coupled; inject dependencies instead.
- You understand what you mocked. A mock that skips a side effect the real dependency has will pass while production breaks.
- Its name describes behavior, not implementation. `rejects an empty email` beats `test validation branch 2`.
- Nothing in production exists only to serve it. A `reset()` method no caller uses is test weight in the wrong file.

## Bug fixes

Write the failing test that reproduces the bug first. It proves you understood the bug, proves the fix works, and stops it coming back.

For a regression test, verify it properly: write it, confirm it passes with the fix, revert the fix, confirm it **fails**, restore. One that passes with and without the fix is decoration.

## When it's hard

| Problem | What it's telling you |
|---|---|
| Don't know how to test it | Write the API you wish existed, then the assertion. Design follows. |
| Test is enormously complicated | The design is complicated. Simplify the interface. |
| Have to mock everything | Too coupled. Inject dependencies. |
| Setup is bigger than the test | Extract helpers — or the unit is doing too much. |

## Reasonable exceptions

Ask rather than deciding alone: throwaway spikes you'll delete, generated code, pure config. "I already tested it manually" and "this one's too simple" aren't on the list — simple code breaks, and manual testing leaves no record and doesn't re-run.

If you already wrote the implementation without a test, don't wrap tests around it and call it TDD. Either delete it and start from the test, or say plainly that this part wasn't TDD so it gets reviewed accordingly.

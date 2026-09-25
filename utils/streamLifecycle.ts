const pendingCleanup = new WeakMap<object, Promise<void>>()

/** A new screen visit must not subscribe before the previous visit has unsubscribed. */
export function afterStreamCleanup(stream: object, setup: () => Promise<void>): Promise<void> {
  return (pendingCleanup.get(stream) ?? Promise.resolve()).then(setup)
}

export function finishStreamSession(stream: object, cleanup: () => Promise<void>) {
  const completion = cleanup().catch((error) => console.warn('Stream cleanup failed', error))
  pendingCleanup.set(stream, completion)
  void completion.then(() => {
    if (pendingCleanup.get(stream) === completion) pendingCleanup.delete(stream)
  })
}

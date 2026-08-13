export function runDeduplicatedMutation<T>(
  pending: Map<string, Promise<unknown>>,
  key: string,
  operation: () => Promise<T>,
  onStart?: () => void,
  onSettled?: () => void,
) {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  onStart?.();
  const promise = operation().finally(() => {
    pending.delete(key);
    onSettled?.();
  });
  pending.set(key, promise);
  return promise;
}

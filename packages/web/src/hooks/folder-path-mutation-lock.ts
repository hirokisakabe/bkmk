import type { QueryClient } from '@tanstack/react-query';

const pendingLocks = new WeakMap<QueryClient, Promise<void>>();

export async function acquireFolderPathMutationLock(queryClient: QueryClient) {
  const previousLock = pendingLocks.get(queryClient) ?? Promise.resolve();
  let releaseCurrentLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseCurrentLock = resolve;
  });
  pendingLocks.set(queryClient, currentLock);

  await previousLock;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseCurrentLock();
    if (pendingLocks.get(queryClient) === currentLock) {
      pendingLocks.delete(queryClient);
    }
  };
}

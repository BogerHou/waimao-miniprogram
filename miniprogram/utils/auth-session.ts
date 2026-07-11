export function shouldPreserveCachedSessionAfterRefreshFailure(
  persistedToken: string | null | undefined,
) {
  return Boolean(persistedToken)
}

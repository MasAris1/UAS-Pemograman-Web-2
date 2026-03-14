export function getErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred'
) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}

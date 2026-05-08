type ErrorWithMessage = {
  message?: string;
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as ErrorWithMessage).message === 'string' &&
    (error as ErrorWithMessage).message?.trim()
  ) {
    return (error as ErrorWithMessage).message as string;
  }

  return fallback;
}

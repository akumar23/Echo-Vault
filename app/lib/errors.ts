import { AxiosError } from 'axios'

export interface ApiErrorResponse {
  detail: string
  [key: string]: unknown
}

export function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return (error as AxiosError).isAxiosError === true
}

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    return error.response?.data?.detail || error.message || 'An error occurred'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unknown error occurred'
}

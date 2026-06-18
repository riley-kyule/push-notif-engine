export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function createSuccessEnvelope<T>(data: T): ApiEnvelope<T> {
  return { success: true, data };
}

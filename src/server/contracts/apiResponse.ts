type ErrorCodes =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "BAD_REQUEST";

type SuccessResponse<T> = {
  data: T;
  error: null;
};

type ErrObject<E = ErrorCodes> = {
  message: string;
  code: E;
};

type ErrorResponse<E = ErrObject> = {
  data: null;
  error: E;
};

export type ApiResponse<T, E = ErrObject> =
  | SuccessResponse<T>
  | ErrorResponse<E>;

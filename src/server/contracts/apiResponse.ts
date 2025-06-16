type SuccessResponse<T> = {
  data: T;
  error: null;
};

type ErrObject = {
  message: string;
  code: string;
  status: number;
};

type ErrorResponse<E = ErrObject> = {
  data: null;
  error: E;
};

export type ApiResponse<T, E = ErrObject> =
  | SuccessResponse<T>
  | ErrorResponse<E>;

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    statusCode = 400,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

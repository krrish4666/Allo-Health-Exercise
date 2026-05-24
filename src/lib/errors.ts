export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "HTTP_ERROR"
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const conflict = (message: string) => new HttpError(409, message, "CONFLICT");
export const gone = (message: string) => new HttpError(410, message, "GONE");
export const notFound = (message: string) => new HttpError(404, message, "NOT_FOUND");
export const badRequest = (message: string) => new HttpError(400, message, "BAD_REQUEST");
export const unauthorized = (message: string) => new HttpError(401, message, "UNAUTHORIZED");

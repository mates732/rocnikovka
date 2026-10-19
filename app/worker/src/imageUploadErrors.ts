/** Upload errors for the R2-backed image path. */
export class ImageUploadError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

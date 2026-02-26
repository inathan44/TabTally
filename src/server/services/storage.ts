export interface UploadResult {
  /** URL the client should PUT the file to. Null if no upload needed (e.g., dev mock). */
  uploadUrl: string | null;
  /** The public URL where the file will be accessible after upload. */
  publicUrl: string;
}

export interface StorageService {
  /** Get upload instructions for a file. Provider decides how the upload happens. */
  getUploadUrl(fileName: string, mimeType: string): Promise<UploadResult>;
  /** Delete a previously uploaded file. */
  deleteFile(publicUrl: string): Promise<void>;
}

const PLACEHOLDER_RECEIPT_URL = "/receipt-placeholder.svg";

/**
 * Development storage service that returns placeholder URLs.
 * No actual upload happens — the client skips the upload step.
 * In production, swap this for a real provider (Supabase, S3, Vercel Blob).
 */
class DevStorageService implements StorageService {
  async getUploadUrl(fileName: string, _mimeType: string): Promise<UploadResult> {
    console.log(`[DevStorage] Mock upload URL for: ${fileName}`);
    return {
      uploadUrl: null,
      publicUrl: `${PLACEHOLDER_RECEIPT_URL}?name=${encodeURIComponent(fileName)}`,
    };
  }

  async deleteFile(publicUrl: string): Promise<void> {
    console.log(`[DevStorage] Mock delete: ${publicUrl}`);
  }
}

function createStorageService(): StorageService {
  // Future: check env for production storage config
  // if (process.env.STORAGE_PROVIDER === "supabase") return new SupabaseStorageService();
  return new DevStorageService();
}

export const storageService = createStorageService();

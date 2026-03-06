/**
 * Client-side image compression using the Canvas API.
 * Resizes large photos (e.g., from phone cameras) to reduce file size
 * while keeping them visually sharp for display and AI parsing.
 */

interface CompressOptions {
  /** Max width or height in pixels (default: 2000) */
  maxDimension?: number;
  /** JPEG quality 0-1 (default: 0.8) */
  quality?: number;
  /** Output mime type (default: "image/jpeg") */
  outputType?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxDimension = 2000, quality = 0.8, outputType = "image/jpeg" } = options;

  const originalSize = file.size;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  // Skip compression if already small enough and no resize needed
  if (scale >= 1 && file.type === outputType && originalSize < 500_000) {
    console.log(
      `[compressImage] Skipped — already ${formatBytes(originalSize)} (${width}×${height})`,
    );
    bitmap.close();
    return file;
  }

  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas 2d context");

  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: outputType, quality });

  const compressedFile = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: outputType,
    lastModified: file.lastModified,
  });

  console.log(
    `[compressImage] ${formatBytes(originalSize)} (${width}×${height}) → ${formatBytes(compressedFile.size)} (${newWidth}×${newHeight}) | ${Math.round((1 - compressedFile.size / originalSize) * 100)}% reduction`,
  );

  return compressedFile;
}

/**
 * image.ts — shrink a photo before upload. A phone camera hands us 12MP HEIC;
 * a 1600px JPEG is what the feed shows and uploads in a second on a walk.
 * Videos pass through untouched. Anything the browser can't decode passes
 * through too — the API's cap is the backstop.
 */
export const MAX_EDGE = 1600;

export async function prepare(file: File): Promise<{ blob: Blob; contentType: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, contentType: file.type };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("encode failed");
    return { blob, contentType: "image/jpeg" };
  } catch {
    return { blob: file, contentType: file.type };
  }
}

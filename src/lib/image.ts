/**
 * Client-side photo prep: downscale to a max long edge and JPEG-compress
 * before upload, so vision-API token cost and upload time stay under control.
 */

const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export interface PreparedImage {
  /** base64 payload without the data: prefix — ready for the API */
  base64: string;
  /** always image/jpeg after re-encode */
  mediaType: "image/jpeg";
  /** object URL for on-screen preview; caller revokes when done */
  previewUrl: string;
  /** JPEG bytes for the storage upload */
  blob: Blob;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the photo on this device.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't compress the photo."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });

  const base64 = await blobToBase64(blob);

  return {
    base64,
    mediaType: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
    blob,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // some formats (HEIC on older Androids) fail — fall through to <img>
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photo format isn't supported. Try retaking it."));
    };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Couldn't read the photo."));
    reader.readAsDataURL(blob);
  });
}

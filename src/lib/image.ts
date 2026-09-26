/**
 * Logos are stored inline as data URLs on the business row, which is loaded on
 * every dashboard page and every customer QR scan. A phone photo straight from
 * the camera can be several megabytes, so logos are scaled down in the browser
 * first. They are shown at most 80px wide; 256px covers high-density screens.
 */
const MAX_LOGO_PX = 256;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export type LogoResult = { dataUrl: string } | { error: string };

export async function prepareLogo(file: File): Promise<LogoResult> {
  if (!ACCEPTED.includes(file.type)) {
    return { error: 'Please choose a PNG, JPG, or WebP image.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That image is over 5 MB. Please choose a smaller one.' };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_LOGO_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { error: 'Your browser could not process this image.' };
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // WebP keeps transparency and is small. Browsers that cannot encode it
    // silently return PNG, which is also accepted by the database check.
    const dataUrl = canvas.toDataURL('image/webp', 0.9);
    return { dataUrl };
  } catch {
    return { error: 'That file could not be read as an image.' };
  }
}

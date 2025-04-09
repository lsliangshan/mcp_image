/**
 * 下载图片
 * @param imageUrl 图片的URL
 * @returns 图片的Buffer
 */
export async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return Buffer.from(await blob.arrayBuffer());
}

/**
 * 获取图片的扩展名
 * @param imageUrl 图片的URL
 * @returns 图片的扩展名
 */
export async function getImageExtension(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return blob.type.split("/")[1];
}

/**
 * 获取图片的格式
 * @param imageUrl 图片的URL
 * @returns 图片的格式
 */
export async function getImageFormat(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return blob.type;
}

/**
 * 获取图片的大小
 * @param imageUrl 图片的URL
 * @returns 图片的大小
 */
export async function getImageSize(
  imageUrl: string
): Promise<{ width: number; height: number }> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return { width: blob.size, height: blob.size };
}

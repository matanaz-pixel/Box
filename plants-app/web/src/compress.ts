/** כיווץ תמונה לפני שליחה: עד 1600px, JPEG. מחזיר base64 ללא קידומת. */
export async function compressImage(file: File, max = 1600, quality = 0.8): Promise<{ base64: string; mime: string; dataUrl: string }> {
  if (!file.type.startsWith("image/")) throw new Error("הקובץ שנבחר אינו תמונה.");
  const bmp = await createImageBitmap(file).catch(() => { throw new Error("לא הצלחתי לקרוא את התמונה."); });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.split(",")[1]!, mime: "image/jpeg", dataUrl };
}

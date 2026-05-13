import { FileContext } from "../types";

export async function processFile(file: File): Promise<FileContext> {
  const reader = new FileReader();
  const id = crypto.randomUUID();
  const timestamp = Date.now();

  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      reader.onload = () => {
        resolve({
          id,
          name: file.name,
          content: reader.result as string,
          type: file.type,
          size: file.size,
          timestamp,
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        let content = reader.result as string;
        // Basic truncation for very large files
        if (content.length > 500000) {
          content = content.substring(0, 500000) + "\n... [truncated for context]";
        }
        resolve({
          id,
          name: file.name,
          content: content,
          type: file.type || 'text/plain',
          size: file.size,
          timestamp,
        });
      };
      reader.readAsText(file);
    }
  });
}

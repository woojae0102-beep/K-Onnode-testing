// @ts-nocheck
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function getAudioDuration(file) {
  const url = URL.createObjectURL(file);
  try {
    const audio = document.createElement('audio');
    audio.src = url;
    await new Promise((r, j) => {
      audio.onloadedmetadata = r;
      audio.onerror = j;
    });
    return audio.duration || 30;
  } finally {
    URL.revokeObjectURL(url);
  }
}

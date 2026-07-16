/**
 * 경량 multipart/form-data 파서 (video + groupId + songId).
 */

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  const boundary = match ? (match[1] || match[2]).trim() : null;
  if (!boundary) return { fields: {}, files: {} };

  const delim = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(delim) + delim.length;

  while (start >= delim.length - 1 && start < buffer.length) {
    const next = buffer.indexOf(delim, start);
    const chunk = buffer.subarray(start, next > start ? next : buffer.length);
    const headerEnd = chunk.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const headerText = chunk.subarray(0, headerEnd).toString('utf8');
    const body = chunk.subarray(headerEnd + 4);
    const trimmed = body.length >= 2 ? body.subarray(0, body.length - 2) : body;

    const nameMatch = /name="([^"]+)"/i.exec(headerText);
    const filenameMatch = /filename="([^"]*)"/i.exec(headerText);
    const fieldName = nameMatch ? nameMatch[1] : null;
    if (!fieldName) {
      start = next + delim.length;
      continue;
    }

    if (filenameMatch) {
      parts.push({
        type: 'file',
        name: fieldName,
        filename: filenameMatch[1],
        data: trimmed,
      });
    } else {
      parts.push({
        type: 'field',
        name: fieldName,
        value: trimmed.toString('utf8'),
      });
    }
    if (next < 0) break;
    start = next + delim.length;
  }

  const fields = {};
  const files = {};
  parts.forEach((p) => {
    if (p.type === 'field') fields[p.name] = p.value;
    else files[p.name] = p;
  });
  return { fields, files };
}

module.exports = { parseMultipart };

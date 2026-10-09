const attachmentIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

function safeId(id) {
  if (typeof id !== 'string' || !attachmentIdPattern.test(id)) throw Object.assign(new Error('INVALID_ATTACHMENT'), { code: 'INVALID_ATTACHMENT' });
  return id;
}

export function createPrivateAttachmentStore({ bucket }) {
  if (!bucket || typeof bucket.put !== 'function' || typeof bucket.get !== 'function' || typeof bucket.delete !== 'function') {
    throw new TypeError('R2 bucket is required');
  }
  return {
    async put({ id, bytes, contentType }) {
      const safe = safeId(id);
      if (!(bytes instanceof Uint8Array) || !bytes.byteLength || typeof contentType !== 'string' || !contentType) {
        throw Object.assign(new Error('INVALID_ATTACHMENT'), { code: 'INVALID_ATTACHMENT' });
      }
      const key = `attachments/${safe}`;
      await bucket.put(key, bytes, { httpMetadata: { contentType } });
      return { id: safe, key, content_type: contentType, size_bytes: bytes.byteLength };
    },
    async get(id) {
      const safe = safeId(id);
      return bucket.get(`attachments/${safe}`);
    },
    async delete(id) {
      const safe = safeId(id);
      await bucket.delete(`attachments/${safe}`);
    },
  };
}

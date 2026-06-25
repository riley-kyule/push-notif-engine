// The client-supplied mimetype/extension on an upload are just request
// metadata an attacker fully controls -- they prove nothing about what the
// bytes actually are. This sniffs the real format from the file's magic
// bytes instead, and intentionally has no SVG/XML case: SVG is script-
// capable markup, not a safe "image" to accept regardless of what its
// header claims, since a campaign asset served back to a browser with that
// content type would execute embedded JS.
const SIGNATURES: Array<{ mimeType: string; matches: (buffer: Buffer) => boolean }> = [
  {
    mimeType: "image/png",
    matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/jpeg",
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: "image/gif",
    matches: (buffer) => {
      if (buffer.length < 6) return false;
      const header = buffer.subarray(0, 6).toString("ascii");
      return header === "GIF87a" || header === "GIF89a";
    },
  },
  {
    mimeType: "image/webp",
    matches: (buffer) =>
      buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/** Returns the detected image mime type from file content, or null if it doesn't match a known, safe image format. */
export function detectImageMimeType(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (signature.matches(buffer)) {
      return signature.mimeType;
    }
  }
  return null;
}

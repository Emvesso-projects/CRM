/**
 * Magic-byte content verification for uploaded files.
 * Protects against spoofed MIME types and disguised executables.
 */

interface SignatureCheck {
  mime: string;
  check: (buf: Buffer) => boolean;
}

const SIGNATURE_CHECKS: SignatureCheck[] = [
  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  {
    mime: "application/pdf",
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x25 &&
      buf[1] === 0x50 &&
      buf[2] === 0x44 &&
      buf[3] === 0x46,
  },
  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  {
    mime: "image/png",
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  // JPEG: 0xFF 0xD8 0xFF
  {
    mime: "image/jpeg",
    check: (buf) =>
      buf.length >= 3 &&
      buf[0] === 0xff &&
      buf[1] === 0xd8 &&
      buf[2] === 0xff,
  },
  // WebP: RIFF at 0..3 and WEBP at 8..11
  {
    mime: "image/webp",
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP",
  },
  // ZIP-based Office documents (DOCX, XLSX)
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      buf[2] === 0x03 &&
      buf[3] === 0x04,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      buf[2] === 0x03 &&
      buf[3] === 0x04,
  },
  {
    mime: "application/zip",
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      buf[2] === 0x03 &&
      buf[3] === 0x04,
  },
];

/**
 * Validates that the buffer's initial magic bytes match the claimed MIME type.
 * If the MIME type is unknown to this checker (e.g. text/csv), allows it through
 * if it doesn't match dangerous binary signatures (like EXE MZ headers 0x4D 0x5A or ELF 0x7F 0x45 0x4C 0x46).
 */
export function validateFileSignature(
  buffer: Buffer,
  declaredMimeType: string,
): { valid: boolean; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty file buffer" };
  }

  // Reject executable formats unconditionally
  // Windows PE (.exe, .dll) -> "MZ"
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, error: "Executable binaries are not permitted" };
  }
  // Linux ELF -> 0x7F 'E' 'L' 'F'
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return { valid: false, error: "Executable binaries are not permitted" };
  }

  const normalizedClaimed = declaredMimeType.toLowerCase().trim();

  // If claimed to be JPEG, allow image/jpg or image/jpeg
  const targetCheck = SIGNATURE_CHECKS.find((c) => {
    if (normalizedClaimed === "image/jpg" && c.mime === "image/jpeg") {
      return true;
    }
    return c.mime === normalizedClaimed;
  });

  if (targetCheck) {
    if (!targetCheck.check(buffer)) {
      return {
        valid: false,
        error: `File content does not match declared MIME type (${declaredMimeType})`,
      };
    }
    return { valid: true };
  }

  // For CSV / plain text
  if (
    normalizedClaimed === "text/csv" ||
    normalizedClaimed === "text/plain" ||
    normalizedClaimed === "application/csv"
  ) {
    // Check if buffer contains null bytes (binary file disguised as text)
    const sampleSize = Math.min(buffer.length, 1024);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0x00) {
        return {
          valid: false,
          error: "Binary file disguised as text/csv",
        };
      }
    }
    return { valid: true };
  }

  return { valid: true };
}

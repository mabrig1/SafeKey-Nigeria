/**
 * Portable, independent helper for local-only evidence SHA-256 hashes.
 * Does not upload or store bytes. A fingerprint is NOT authentication.
 */
export const MAX_LOCAL_FILE_BYTES=15*1024*1024;
export async function hashLocalFile(file, subtle=globalThis.crypto?.subtle){
  if(!file || typeof file.size!=="number" || typeof file.arrayBuffer!=="function")
    throw Error("Choose a local file.");
  if(file.size<=0 || file.size>MAX_LOCAL_FILE_BYTES)
    throw Error("Choose a non-empty file not exceeding 15 MB.");
  if(!subtle || typeof subtle.digest!=="function")
    throw Error("Secure SHA-256 hashing is unavailable.");
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength!==file.size)
    throw Error("File size changed while reading. Try again.");
  const hash=await subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}

import test from "node:test";
import assert from "node:assert/strict";
import { hashLocalFile, MAX_LOCAL_FILE_BYTES } from "../public/evidence-core.js";

const fakeFile = bytes => ({
  size: bytes.length,
  async arrayBuffer(){
    const arr=new Uint8Array(bytes);
    return arr.buffer;
  }
});
test("SHA-256 digest matches a known test vector",async()=>{
  const digest=await hashLocalFile(fakeFile(new TextEncoder().encode("abc")));
  assert.equal(digest,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("rejects empty and oversized files before reading bytes",async()=>{
  let accessed=false;
  await assert.rejects(()=>hashLocalFile({size:MAX_LOCAL_FILE_BYTES+1,async arrayBuffer(){accessed=true;return new ArrayBuffer(0)}}),/15 MB/);
  await assert.rejects(()=>hashLocalFile(fakeFile(new Uint8Array(0))),/non-empty/);
  assert.equal(accessed,false);
});
test("rejects file modification during reading",async()=>{
  await assert.rejects(()=>hashLocalFile({size:5,async arrayBuffer(){return new Uint8Array(4).buffer}}),/size changed/);
});
test("never contacts a network service",async()=>{
  const badFetch=globalThis.fetch;
  globalThis.fetch=()=>{throw Error("No network calls are expected")};
  try{assert.match(await hashLocalFile(fakeFile(new Uint8Array([1,2,3]))),/^[0-9a-f]{64}$/)}
  finally{globalThis.fetch=badFetch}
});

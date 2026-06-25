import assert from "node:assert/strict";
import dns from "node:dns";
import test from "node:test";

import { assertSafeFetchTarget, UnsafeFetchTargetError } from "./ssrf-guard";

function stubLookup(addresses: Array<{ address: string; family: 4 | 6 }>): () => void {
  const original = dns.promises.lookup;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (dns.promises as any).lookup = async () => addresses;
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dns.promises as any).lookup = original;
  };
}

test("assertSafeFetchTarget allows a hostname that resolves to a public IP", async () => {
  const restore = stubLookup([{ address: "93.184.216.34", family: 4 }]);
  try {
    await assert.doesNotReject(() => assertSafeFetchTarget("https://example.com/feed.xml"));
  } finally {
    restore();
  }
});

test("assertSafeFetchTarget rejects a hostname that resolves to a loopback address", async () => {
  const restore = stubLookup([{ address: "127.0.0.1", family: 4 }]);
  try {
    await assert.rejects(() => assertSafeFetchTarget("https://internal.example.com/feed.xml"), UnsafeFetchTargetError);
  } finally {
    restore();
  }
});

test("assertSafeFetchTarget rejects a hostname that resolves to the cloud metadata address", async () => {
  const restore = stubLookup([{ address: "169.254.169.254", family: 4 }]);
  try {
    await assert.rejects(() => assertSafeFetchTarget("https://metadata.example.com/"), UnsafeFetchTargetError);
  } finally {
    restore();
  }
});

test("assertSafeFetchTarget rejects a literal private IP without needing DNS", async () => {
  await assert.rejects(() => assertSafeFetchTarget("http://10.0.0.5/webhook"), UnsafeFetchTargetError);
  await assert.rejects(() => assertSafeFetchTarget("http://192.168.1.1/webhook"), UnsafeFetchTargetError);
  await assert.rejects(() => assertSafeFetchTarget("http://172.16.0.1/webhook"), UnsafeFetchTargetError);
});

test("assertSafeFetchTarget rejects localhost", async () => {
  await assert.rejects(() => assertSafeFetchTarget("http://localhost:8080/webhook"), UnsafeFetchTargetError);
});

test("assertSafeFetchTarget rejects non-http(s) schemes", async () => {
  await assert.rejects(() => assertSafeFetchTarget("file:///etc/passwd"), UnsafeFetchTargetError);
  await assert.rejects(() => assertSafeFetchTarget("gopher://example.com"), UnsafeFetchTargetError);
});

test("assertSafeFetchTarget rejects a malformed URL", async () => {
  await assert.rejects(() => assertSafeFetchTarget("not a url"), UnsafeFetchTargetError);
});

test("assertSafeFetchTarget rejects when every resolved address is private", async () => {
  const restore = stubLookup([
    { address: "10.0.0.1", family: 4 },
    { address: "10.0.0.2", family: 4 },
  ]);
  try {
    await assert.rejects(() => assertSafeFetchTarget("https://internal-multi.example.com/"), UnsafeFetchTargetError);
  } finally {
    restore();
  }
});

test("assertSafeFetchTarget allows a literal public IP", async () => {
  await assert.doesNotReject(() => assertSafeFetchTarget("http://93.184.216.34/webhook"));
});

import dns from "node:dns";
import net from "node:net";

export class UnsafeFetchTargetError extends Error {}

// Checking the URL's hostname string alone isn't enough -- a hostname that
// resolves to a public IP when an admin first saves an RSS feed/webhook URL
// can be repointed at an internal address by the time it's actually fetched
// (DNS rebinding), so this resolves the hostname and checks the real IP
// right before every fetch, not just at creation time.
function isPrivateOrReservedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const octets = ip.split(".").map(Number);
    const [a, b] = octets;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 0) return true; // "this network"
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true; // shared address space (CGNAT)
    return false;
  }

  if (family === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local (fc00::/7)
    if (normalized.startsWith("::ffff:")) return isPrivateOrReservedIp(normalized.slice("::ffff:".length)); // IPv4-mapped
    return false;
  }

  return true; // unparseable -- refuse rather than guess
}

// Validates that `rawUrl` is http(s) and does not resolve to a private,
// loopback, link-local, or cloud-metadata address. Throws UnsafeFetchTargetError
// if not. Call this immediately before every outbound fetch to a URL an admin
// supplied (RSS feed URLs, automation webhook URLs) -- never cache the result.
export async function assertSafeFetchTarget(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeFetchTargetError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeFetchTargetError("Only http(s) URLs are allowed");
  }

  const hostname = url.hostname;
  if (hostname === "localhost") {
    throw new UnsafeFetchTargetError("URLs pointing at localhost are not allowed");
  }

  const directIpFamily = net.isIP(hostname);
  if (directIpFamily !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeFetchTargetError("URLs pointing at private or reserved IP ranges are not allowed");
    }
    return;
  }

  let addresses: string[];
  try {
    const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((entry) => entry.address);
  } catch {
    throw new UnsafeFetchTargetError("Unable to resolve host");
  }

  if (addresses.length === 0 || addresses.some((address) => isPrivateOrReservedIp(address))) {
    throw new UnsafeFetchTargetError("URLs that resolve to private or reserved IP ranges are not allowed");
  }
}

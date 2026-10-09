import { request as httpsRequest } from 'node:https';
import { readFileSync } from 'node:fs';

export interface NetworkReply { status: number; body: unknown }
export async function requestJSON(url: URL, method: 'GET' | 'POST', body?: string, headers: Record<string, string> = {}, useServiceCertificate = false): Promise<NetworkReply> {
  return new Promise((resolve, reject) => {
    const signal = AbortSignal.timeout(5000);
    const ca = readFileSync('/trust/server-ca.pem');
    const certificate = useServiceCertificate ? readFileSync('/caller/cert.pem') : undefined;
    const privateKey = useServiceCertificate ? readFileSync('/caller/key.pem') : undefined;
    const req = httpsRequest(url, { method, ca, cert: certificate, key: privateKey,
      rejectUnauthorized: true, servername: url.hostname, signal, headers: { ...headers, ...(body === undefined ? {} : { 'content-type': headers['content-type'] ?? 'application/json', 'content-length': String(Buffer.byteLength(body)) }) } }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1_048_576) { req.destroy(new Error('upstream body too large')); return; } chunks.push(chunk); });
      response.on('end', () => {
        try { resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }); }
        catch { reject(new Error('upstream response invalid')); }
      });
      response.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}

import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const keys=[['google','https://dl.google.com/linux/linux_signing_key.pub','54dea5f6c2a26091578cf52a999cebc6b64df478d37ad4dce96376b711e3b27c'],['microsoft','https://packages.microsoft.com/keys/microsoft.asc','2fa9c05d591a1582a9aba276272478c262e95ad00acf60eaee1644d93941e3c6']];
for(const [name,url,hash] of keys){
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('key_download_failed');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('key_digest_mismatch');
 writeFileSync(`/tmp/${name}.asc`,bytes);
}
writeFileSync('/tmp/sources.list',`deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian bookworm main\ndeb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian-security bookworm-security main\ndeb [signed-by=/tmp/google.asc] https://dl.google.com/linux/chrome/deb/ stable main\ndeb [signed-by=/tmp/microsoft.asc] https://packages.microsoft.com/repos/edge stable main\n`);

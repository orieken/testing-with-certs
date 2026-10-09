import Keycloak from 'keycloak-js';
// Bound every SDK XHR without changing the pinned dependency's source.
const NativeXMLHttpRequest=window.XMLHttpRequest;
window.XMLHttpRequest=class BoundedXMLHttpRequest extends NativeXMLHttpRequest {
  constructor(){super();this.timeout=10000;}
};
function element(id:string):HTMLElement {
  const value=document.getElementById(id);
  if(!value) throw new Error('missing_element');
  return value;
}
const keycloak=new Keycloak({url:'https://auth.magic.test:9443',realm:'magic-shop',clientId:'spike-spa'});
const status=element('status');
element('login').addEventListener('click',()=>{void keycloak.login({redirectUri:'https://shop.magic.test:8443/callback'});});
try {
  const authenticated=await keycloak.init({pkceMethod:'S256',checkLoginIframe:false,messageReceiveTimeout:10000});
  if(authenticated){
    const result=await fetch('/api/identity',{headers:{Authorization:`Bearer ${keycloak.token}`},signal:AbortSignal.timeout(10000)});
    if(!result.ok) throw new Error('API rejected identity');
    element('identity').textContent=JSON.stringify(await result.json());
    status.textContent=`Authenticated: ${keycloak.tokenParsed?.preferred_username}`;
  }
} catch {status.textContent='Authentication failed';}

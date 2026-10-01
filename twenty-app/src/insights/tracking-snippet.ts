// The script tag customers paste into their site. It keeps a random visitor
// id in localStorage and posts one beacon per page load to the public `track`
// route. Call `pulseTrack('ada@example.com')` after a form submit to link the
// visitor to a Person. sendBeacon sends text/plain, so no CORS preflight.

export const TRACKING_SNIPPET_TEMPLATE = `<script>
(function(w,d,k,e){try{var s=w.localStorage,id=s.getItem(k);if(!id){id=w.crypto&&crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2));s.setItem(k,id)}
w.pulseTrack=function(m){var b=JSON.stringify({visitorId:id,url:location.href,referrer:d.referrer||null,email:m||null});
navigator.sendBeacon?navigator.sendBeacon(e,b):fetch(e,{method:'POST',body:b,keepalive:true,mode:'no-cors'})};w.pulseTrack()}catch(_){}})
(window,document,'pulse_vid','__ENDPOINT__');
</script>`;

/** The snippet for a Twenty server, e.g. https://crm.example.com -> .../s/track */
export const trackingSnippet = (twentyUrl: string): string =>
  TRACKING_SNIPPET_TEMPLATE.replace('__ENDPOINT__', `${twentyUrl.replace(/\/+$/, '')}/s/track`);

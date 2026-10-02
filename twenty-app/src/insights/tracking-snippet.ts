// The script tag customers paste into their site, or into a Google Tag
// Manager "Custom HTML" tag fired on All Pages. It keeps a random visitor id
// in localStorage and posts small beacons to the public `track` route:
// - a page view on load and on single-page-app navigation,
// - time on page and scroll depth when the tab is hidden or closed,
// - clicks on buttons and contact / pricing / booking links,
// - the email typed into any form on submit (links the visitor to a Person).
// Call `pulseTrack('ada@example.com')` to link a visitor yourself.
// Events are batched for a second (sent at once on form submit and when the
// tab is hidden) so they reach the server in order. sendBeacon sends
// text/plain, so there is no CORS preflight. Plain ES5 so GTM accepts it:
// no let/const/arrows, and no function declarations inside blocks.

export const TRACKING_SNIPPET_TEMPLATE = `<script>
(function(w,d,k,e){try{if(w.__pulseTrack)return;w.__pulseTrack=1;
var s=w.localStorage,id=s.getItem(k);if(!id){id=w.crypto&&crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2));s.setItem(k,id)}
var q=[],tm=0,t0=Date.now(),max=0;
var flush=function(){clearTimeout(tm);if(!q.length)return;var b=JSON.stringify({visitorId:id,url:location.href,referrer:d.referrer||null,events:q.splice(0,20)});
if(navigator.sendBeacon){navigator.sendBeacon(e,b)}else{fetch(e,{method:'POST',body:b,keepalive:true,mode:'no-cors'})}if(q.length)flush()};
var send=function(o,now){o.url=location.href;q.push(o);clearTimeout(tm);if(now)flush();else tm=setTimeout(flush,1000)};
w.addEventListener('scroll',function(){var h=d.documentElement,p=Math.round((w.scrollY+w.innerHeight)*100/Math.max(h.scrollHeight,1));if(p>max)max=Math.min(p,100)},{passive:true});
d.addEventListener('visibilitychange',function(){if(d.visibilityState==='hidden'){send({type:'engage',seconds:Math.round((Date.now()-t0)/1000),scroll:max},1)}else{t0=Date.now()}});
d.addEventListener('click',function(ev){var a=ev.target&&ev.target.closest&&ev.target.closest('a,button,[role=button],input[type=submit]');if(!a)return;
var l=(a.innerText||a.value||a.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim(),h=a.getAttribute('href')||'';if(!l)return;
if(a.tagName!=='A'||/^(mailto|tel):/i.test(h)||/contact|demo|book|quote|call|pricing|price|start|hire|talk|meeting|calendly/i.test(l+' '+h))send({type:'click',label:l.slice(0,80)})},true);
d.addEventListener('submit',function(ev){var f=ev.target,i=f&&f.querySelector&&f.querySelector('input[type=email],input[name*=mail i]'),m=i&&i.value?i.value.trim():'';
send({type:'identify',email:/^[^@\\s"]+@[^@\\s"]+\\.[a-z]{2,}$/i.test(m)?m:null},1)},true);
var ps=history.pushState;history.pushState=function(){ps.apply(this,arguments);setTimeout(function(){send({})},0)};w.addEventListener('popstate',function(){send({})});
w.pulseTrack=function(m){send({type:'identify',email:m||null},1)};send({},1)}catch(_){}})
(window,document,'pulse_vid','__ENDPOINT__');
</script>`;

/**
 * The snippet for a Twenty server. Takes either the server root
 * (https://crm.example.com -> .../s/track) or the route's own URL, which on
 * Twenty Cloud lives on a separate functions host (https://ws.withtwenty.com/track).
 */
export const trackingSnippet = (twentyUrl: string): string =>
  TRACKING_SNIPPET_TEMPLATE.replace('__ENDPOINT__', trackingEndpoint(twentyUrl));

export const trackingEndpoint = (twentyUrl: string): string =>
  /\/track\/?$/.test(twentyUrl) ? twentyUrl.replace(/\/+$/, '') : `${twentyUrl.replace(/\/+$/, '')}/s/track`;

export function syncPushSession(userId:string|null){
 try{if(localStorage.getItem('hidrotrack:push-user')!==userId)localStorage.removeItem('hidrotrack:push-active');}catch{}
 if(!('serviceWorker' in navigator))return;
 void navigator.serviceWorker.getRegistration('/').then(registration=>{registration?.active?.postMessage({type:'PUSH_SESSION',userId});}).catch(()=>{});
}
export function isMobileDevice(){const nav=navigator as Navigator&{userAgentData?:{mobile?:boolean}};return Boolean(nav.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1));}

export function syncResolvedPushStops(tripId:string,customers:string[]){if(!('serviceWorker' in navigator)||!customers.length)return;void navigator.serviceWorker.getRegistration('/').then(reg=>reg?.active?.postMessage({type:'VISITS_RESOLVED',tripId,customers})).catch(()=>{});}

export async function signOutWithPushCleanup(client:import('@supabase/supabase-js').SupabaseClient){
 if('serviceWorker' in navigator){try{const reg=await navigator.serviceWorker.getRegistration('/'),subscription=await reg?.pushManager.getSubscription();if(subscription){await client.rpc('push_unsubscribe',{p_endpoint:subscription.endpoint});await subscription.unsubscribe();}reg?.active?.postMessage({type:'PUSH_SESSION',userId:null});localStorage.removeItem('hidrotrack:push-active');localStorage.removeItem('hidrotrack:push-user');}catch{/* A network failure must not prevent signing out. */}}
 return client.auth.signOut();
}

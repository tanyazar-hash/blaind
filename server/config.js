// Project URL and publishable key identify the public Supabase project, not a secret.
// Never use a service-role credential for requests made on behalf of an administrator.
export function supabaseConfig(env=process.env){
 const url=env.SUPABASE_URL||'https://ukihbdewnciurkaugtsd.supabase.co';
 const key=env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_NiISTMvzl7bHeJiB7Nwz1g_pVdxuM9q';
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'&&!(env.NODE_ENV==='test'&&parsed.hostname==='127.0.0.1'))throw new Error('SUPABASE_URL must use HTTPS');
 if(!key.startsWith('sb_publishable_'))throw new Error('Use a Supabase publishable key, not a privileged credential');
 return {url:parsed.origin,key};
}

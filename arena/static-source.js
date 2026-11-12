import {SupabaseStore} from '../server/store.js';
import {supabaseConfig} from '../server/config.js';
import {defaultDocument,publicSnapshot} from '../server/defaults.js';

// Only the publishable key is bundled. Reads remain subject to the existing anon RLS.
const config=typeof __PUBLIC_SUPABASE_CONFIG__==='object'?__PUBLIC_SUPABASE_CONFIG__:supabaseConfig({});
// Browser fetch requires the global receiver; do not call it as a store method.
const store=new SupabaseStore({...config,fetchImpl:(...args)=>globalThis.fetch(...args)});
export async function staticSnapshot(){
 let row;
 try{row=await store.readDocument()}catch(error){
  // Match the server: only an uninitialised database may use the original seed.
  // Network, permissions and authentication failures must remain visible.
  if(error.code!=='DATABASE_NOT_INITIALIZED')throw error;
  row={version:0,document:defaultDocument()};
 }
 return publicSnapshot(row);
}

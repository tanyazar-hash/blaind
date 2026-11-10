import {defaultDocument} from '../server/defaults.js';
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
if(!SUPABASE_URL?.startsWith('https://')||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
const response=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/arena_documents',{
 method:'POST',redirect:'error',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,
 'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
 body:JSON.stringify({id:'main',version:1,document:defaultDocument()})
});
if(!response.ok)throw new Error('Database initialization failed. Apply supabase/schema.sql first. HTTP '+response.status);
const rows=await response.json();
console.log(rows.length?'Начальные данные добавлены.':'Данные уже существуют; ничего не перезаписано.');

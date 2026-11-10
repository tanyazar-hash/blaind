import {hashPassword} from '../server/auth.js';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
let password='';
if(process.argv.includes('--stdin')){
 for await(const chunk of process.stdin)password+=chunk.toString();
 password=password.replace(/\r?\n$/,'');
}else{
 if(!process.stdin.isTTY)throw new Error('Use --stdin or an interactive terminal.');
 process.stdout.write('Пароль администратора: ');
 process.stdin.setRawMode(true);process.stdin.resume();
 password=await new Promise((done,reject)=>{
  let input='';
  process.stdin.on('data',chunk=>{
   const text=chunk.toString();
   if(text==='\u0003'){reject(new Error('Cancelled'));return}
   if(text.includes('\r')||text.includes('\n')){done(input);return}
   if(text==='\u007f')input=input.slice(0,-1);else input+=text;
  });
 });
 process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');
}
if(password.length<10||Buffer.byteLength(password)>1024)throw new Error('Use a password with at least 10 characters.');
const hash=await hashPassword(password);password='';
const target=resolve('.env.admin.local');
await writeFile(target,'ADMIN_USERNAME=admin\nADMIN_PASSWORD_HASH='+hash+'\nADMIN_SESSION_SECRET='+randomBytes(48).toString('base64url')+'\n',{mode:0o600,flag:'wx'});
console.log('Создан .env.admin.local (только хеш и случайный серверный секрет, без пароля). Не добавляйте файл в Git.');
process.exit(0);

import {HttpError} from './errors.js';
export const MAX_IMAGE_BYTES=3*1024*1024;
const text=(value,max,empty=false)=>{
  if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw new HttpError(400,'Проверьте текстовые поля.','VALIDATION');
  return value.trim();
};
const int=(value,max=1e9)=>{
  if(!Number.isSafeInteger(value)||value<0||value>max)throw new HttpError(400,'Числа должны быть целыми и неотрицательными.','VALIDATION');
  return value;
};
export function validId(value){return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)}
export function imageKey(value){return typeof value==='string'&&/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value)}
function imageFields(input){
  const imageUrl=input.imageUrl===null||input.imageUrl===''?null:text(input.imageUrl,2048);
  if(imageUrl){
    const u=new URL(imageUrl,'https://local.invalid/arena/');
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new HttpError(400,'Недопустимая ссылка изображения.','VALIDATION');
  }
  const key=input.imageStorageKey||null;
  if(key&&!imageKey(key))throw new HttpError(400,'Недопустимый файл изображения.','VALIDATION');
  return {imageUrl,imageStorageKey:key};
}
export function playerInput(input,id){
  if(!input||typeof input!=='object')throw new HttpError(400,'Неверные данные игрока.','VALIDATION');
  const p={id,nickname:text(input.nickname,80),tournamentsPlayed:int(input.tournamentsPlayed,100000),wins:int(input.wins,100000),points:int(input.points,1e12)};
  if(p.wins>p.tournamentsPlayed)throw new HttpError(400,'Побед не может быть больше сыгранных турниров.','VALIDATION');
  return p;
}
export function tournamentInput(input,id){
  if(!input||typeof input!=='object')throw new HttpError(400,'Неверные данные турнира.','VALIDATION');
  if(typeof input.startsAt!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(input.startsAt)||!Number.isFinite(Date.parse(input.startsAt)))throw new HttpError(400,'Укажите дату, время и часовой пояс.','VALIDATION');
  if(!Array.isArray(input.details)||input.details.length>20)throw new HttpError(400,'Не более 20 строк дополнительной информации.','VALIDATION');
  const status=input.status||'scheduled';
  if(!['scheduled','active','completed','cancelled'].includes(status))throw new HttpError(400,'Неверный статус турнира.','VALIDATION');
  let endsAt=null;
  if(input.endsAt){
    if(typeof input.endsAt!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(input.endsAt)||!Number.isFinite(Date.parse(input.endsAt))||Date.parse(input.endsAt)<=Date.parse(input.startsAt))throw new HttpError(400,'Окончание должно быть позже начала турнира.','VALIDATION');
    endsAt=new Date(input.endsAt).toISOString();
  }
  const fit=input.imageFit||'cover';
  if(!['cover','contain'].includes(fit))throw new HttpError(400,'Неверный формат изображения.','VALIDATION');
  const focus=input.imageFocus||{x:50,y:50};
  if(!['x','y'].every(k=>Number.isFinite(focus[k])&&focus[k]>=0&&focus[k]<=100))throw new HttpError(400,'Положение изображения — от 0 до 100.','VALIDATION');
  return {id,status,endsAt,title:text(input.title,140),startsAt:new Date(input.startsAt).toISOString(),
    description:text(input.description,2000),details:input.details.map(d=>({label:text(d.label,80),value:text(d.value,300)})),
    displayOrder:int(input.displayOrder,100000),...imageFields(input),
    imageAlt:text(input.imageAlt||'',300,true),imageFit:fit,imageFocus:{x:focus.x,y:focus.y}};
}
const heroFields={
  eyebrow:140,titleLine1:100,titleLine2:100,subtitle:500,description:1000,
  primaryLabel:80,secondaryLabel:80,leadersTitle:100,leadersTag:60,demoLabel:100,
  playersMetricLabel:100,tournamentsMetricLabel:100,scrollCue:120
};
function link(value){
  value=text(value,1000);
  if(value.startsWith('#')||(value.startsWith('/')&&!value.startsWith('//')))return value;
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href}catch{}
  throw new HttpError(400,'Ссылка должна начинаться с /, # или https://.','VALIDATION');
}
export function heroInput(input){
  if(!input||typeof input!=='object')throw new HttpError(400,'Неверные данные первого экрана.','VALIDATION');
  const hero={};
  for(const [key,max] of Object.entries(heroFields))hero[key]=text(input[key]??'',max,['titleLine2','description','playersMetricLabel','tournamentsMetricLabel'].includes(key));
  hero.primaryHref=link(input.primaryHref);hero.secondaryHref=link(input.secondaryHref);
  const image=imageFields({imageUrl:input.backgroundImageUrl,imageStorageKey:input.backgroundImageStorageKey});
  hero.backgroundImageUrl=image.imageUrl;hero.backgroundImageStorageKey=image.imageStorageKey;
  if(!Number.isFinite(input.backgroundOpacity)||input.backgroundOpacity<0||input.backgroundOpacity>1)throw new HttpError(400,'Непрозрачность фона — от 0 до 100%.','VALIDATION');
  hero.backgroundOpacity=input.backgroundOpacity;
  return hero;
}
export function settingsInput(input){
  if(!input||typeof input.playersIsDemo!=='boolean'||typeof input.tournamentsIsDemo!=='boolean')throw new HttpError(400,'Проверьте настройки данных.','VALIDATION');
  const timeZone=text(input.timeZone,100);
  try{new Intl.DateTimeFormat('ru',{timeZone}).format()}catch{throw new HttpError(400,'Неизвестный часовой пояс.','VALIDATION')}
  return {timeZone,playersIsDemo:input.playersIsDemo,tournamentsIsDemo:input.tournamentsIsDemo};
}
export function inspectImage(bytes){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw new HttpError(413,'Размер изображения — не более 3 МБ.','IMAGE_SIZE');
  let width,height,mime,ext;
  if(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){
    width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);mime='image/png';ext='png';
    if(bytes.toString('ascii',bytes.length-8,bytes.length-4)!=='IEND')throw new HttpError(400,'Повреждённое PNG-изображение.','IMAGE_FORMAT');
  }else if(bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
    const kind=bytes.toString('ascii',12,16);
    if(bytes.readUInt32LE(4)+8!==bytes.length)throw new HttpError(400,'Повреждённое WebP-изображение.','IMAGE_FORMAT');
    if(kind==='VP8X'){
      if(bytes[20]&2)throw new HttpError(400,'Загрузите статичное изображение без анимации.','IMAGE_FORMAT');
      width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);
    }else if(kind==='VP8 '&&bytes.subarray(23,26).equals(Buffer.from([157,1,42]))){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383}
    else if(kind==='VP8L'&&bytes[20]===47){const v=bytes.readUInt32LE(21);width=(v&16383)+1;height=((v>>>14)&16383)+1}
    mime='image/webp';ext='webp';
  }else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){
    let at=2;
    while(at+4<bytes.length){
      if(bytes[at]!==255){at++;continue}
      const marker=bytes[at+1];if(marker===218)break;
      if(marker===255){at++;continue}
      const length=bytes.readUInt16BE(at+2);if(length<2||at+length+2>bytes.length)break;
      if(marker>=192&&marker<=207&&![196,200,204].includes(marker)&&length>=8){height=bytes.readUInt16BE(at+5);width=bytes.readUInt16BE(at+7);break}
      at+=length+2;
    }
    mime='image/jpeg';ext='jpg';
  }
  if(!width||!height||!mime)throw new HttpError(400,'Поддерживаются изображения JPEG, PNG и WebP.','IMAGE_FORMAT');
  if(width>8192||height>8192||width*height>20000000)throw new HttpError(400,'Изображение слишком большое: максимум 20 мегапикселей.','IMAGE_DIMENSIONS');
  return {width,height,mime,ext};
}

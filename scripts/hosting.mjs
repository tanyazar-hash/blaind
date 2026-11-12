export function hostingConfig(env=process.env){
 const base=env.SITE_BASE_PATH||'/';
 if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))throw new Error('SITE_BASE_PATH must be / or a directory path such as /blaind/');
 if(env.STATIC_HOSTING&&!['0','1'].includes(env.STATIC_HOSTING))throw new Error('STATIC_HOSTING must be 0 or 1');
 const staticHosting=env.STATIC_HOSTING==='1';
 const admin=new URL(env.HOSTED_ADMIN_URL||'https://blaind-tanyazar-hashs-projects.vercel.app/admin/');
 if(admin.protocol!=='https:'||admin.username||admin.password||admin.search||admin.hash)throw new Error('HOSTED_ADMIN_URL must be a public HTTPS admin page URL without credentials, query or fragment');
 return {base,staticHosting,adminUrl:admin.href};
}
export function prefixHtml(html,base){
 return html.replace(/\b(href|src|action|poster|data-full)=(['"])\/(?!\/)([^'"]*)\2/g,(_,attr,quote,path)=>`${attr}=${quote}${base}${path}${quote}`)
  .replace(/\bsrcset=(['"])(.*?)\1/g,(_,quote,value)=>`srcset=${quote}${value.replace(/(^|,\s*)\/(?!\/)/g,'$1'+base)}${quote}`);
}
export function prefixCss(css,base){
 return css.replace(/url\(\s*(['"]?)\/(?!\/)/g,(_,quote)=>`url(${quote}${base}`);
}
export function adminRedirect(url,base){
 const escaped=url.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;url=${escaped}"><title>Блаинд · Управление ареной</title><link rel="stylesheet" href="${base}admin/admin.css"></head><body><main><h1>Управление <em>ареной.</em></h1><p><a href="${escaped}" rel="nofollow">Открыть защищённую админ-панель</a></p></main></body></html>`;
}

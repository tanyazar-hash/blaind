// The build supplies the deployment prefix; unbundled local development uses /.
export const siteBase=typeof __SITE_BASE__==='string'?__SITE_BASE__:'/';
export const staticHosting=typeof __STATIC_HOSTING__==='boolean'?__STATIC_HOSTING__:false;
export function sitePath(path=''){
 return siteBase+path.replace(/^\/+/, '');
}

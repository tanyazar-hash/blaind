// Local Auth simulator only. Production uses the remote SupabaseAuth adapter.
import {randomUUID} from 'node:crypto';
import {HttpError} from '../server/errors.js';
export const adminId='11111111-1111-4111-8111-111111111111';
export const secondAdminId='22222222-2222-4222-8222-222222222222';
export const visitorId='33333333-3333-4333-8333-333333333333';
export const testPassword='test-only-password';
export function authFixture(){
 const users=[{id:adminId,email:'admin@example.test'},{id:secondAdminId,email:'second@example.test'},{id:visitorId,email:'visitor@example.test'}];
 const access=new Map(),refresh=new Map();
 const denied=()=>{throw new HttpError(401,'Неверные данные входа или сессия завершилась.','UNAUTHORIZED')};
 function issue(user){const s={accessToken:randomUUID(),refreshToken:randomUUID(),user};access.set(s.accessToken,user);refresh.set(s.refreshToken,user);return s}
 return {
  identity:token=>access.get(token)?.id,
  async signIn(email,password){const user=users.find(u=>u.email===email);if(!user||password!==testPassword)return denied();return issue(user)},
  async user(token){return access.get(token)||denied()},
  async refresh(token){const user=refresh.get(token);if(!user)return denied();refresh.delete(token);return issue(user)},
  async logout(token){const user=access.get(token);for(const [t,u]of refresh)if(u===user)refresh.delete(t)},
  expireAccess(token){access.delete(token)}
 };
}

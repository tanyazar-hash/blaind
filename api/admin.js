import {createArenaBackend} from '../server/app.js';
export default async function handler(req,res){return createArenaBackend().admin(req,res)}

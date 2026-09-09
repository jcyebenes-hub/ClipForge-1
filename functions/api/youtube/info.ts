// Puente de Cloudflare Pages Functions hacia el handler existente.
// No duplica lógica: importa el mismo handler que usaba el servidor Express.
import {GET as GET_0, POST as POST_1} from '../../../src/app/api/youtube/info/route';
import { ejecutar, type PagesCtx } from '../../_shared/env';

export const onRequestGet = (ctx: PagesCtx) => ejecutar(GET_0, ctx);
export const onRequestPost = (ctx: PagesCtx) => ejecutar(POST_1, ctx);

// Puente de Cloudflare Pages Functions hacia el handler existente.
// No duplica lógica: importa el mismo handler que usaba el servidor Express.
import {GET as GET_0} from '../../../src/app/api/youtube/auth/route';
import { ejecutar, type PagesCtx } from '../../_shared/env';

export const onRequestGet = (ctx: PagesCtx) => ejecutar(GET_0, ctx);

// Puente de Cloudflare Pages Functions hacia el handler existente.
// No duplica lógica: importa el mismo handler que usaba el servidor Express.
import {POST as POST_0} from '../../src/app/api/traducir/route';
import { ejecutar, type PagesCtx } from '../_shared/env';

export const onRequestPost = (ctx: PagesCtx) => ejecutar(POST_0, ctx);

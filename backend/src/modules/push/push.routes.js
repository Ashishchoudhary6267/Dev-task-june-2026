import { Hono } from 'hono';
import { subscribeEndpoint, unsubscribeEndpoint, toggleGlobalPush } from './push.controller.js';
// import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authenticate } from "../../middleware/auth.middleware.js"

const pushRoutes = new Hono();

// All push routes require authentication
pushRoutes.use('/*', authenticate);

pushRoutes.post('/subscribe', subscribeEndpoint);
pushRoutes.post('/unsubscribe', unsubscribeEndpoint);
pushRoutes.post('/toggle', toggleGlobalPush);

export default pushRoutes;

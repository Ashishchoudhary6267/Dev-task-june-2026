import { Hono } from "hono";
import { authenticate } from "../../middleware/auth.middleware.js";
import { 
    getChannels, 
    createChannel, 
    getOrCreateDirectChannel, 
    getMessages, 
    sendMessage, 
    getChannelMembers, 
    addChannelMember,
    deleteChannel
} from "./chat.controller.js";

const router = new Hono();

router.get("/chat/channels", authenticate, getChannels);
router.post("/chat/channels", authenticate, createChannel);
router.post("/chat/channels/direct", authenticate, getOrCreateDirectChannel);

router.get("/chat/channels/:channelId/messages", authenticate, getMessages);
router.post("/chat/channels/:channelId/messages", authenticate, sendMessage);

router.get("/chat/channels/:channelId/members", authenticate, getChannelMembers);
router.post("/chat/channels/:channelId/members", authenticate, addChannelMember);
router.delete("/chat/channels/:channelId", authenticate, deleteChannel);

export default router;

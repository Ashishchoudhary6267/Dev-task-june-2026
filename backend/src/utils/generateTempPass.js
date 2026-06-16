
import crypto from "node:crypto";

/**
 * Generate a random temporary password
 */
export const generateTempPassword = () => {
    return crypto.randomBytes(4).toString('hex') + 'A1!'; // e.g. "a3f2b1c4A1!" — 11 chars, meets most requirements
};
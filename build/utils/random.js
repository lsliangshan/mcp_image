import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);
export function getRandomId(length = 10) {
    return nanoid(length);
}

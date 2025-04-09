import { FastMCP } from "fastmcp";
import { z } from "zod";
import { servers } from "../config/index.js";
import { downloadImage } from "../utils/image.js";
import sharp from "sharp";
import fs from "fs";
const ServerName = "image";
const server = new FastMCP({
    name: servers[ServerName].name,
    version: servers[ServerName].version,
});
server.addTool({
    name: "tinyImage",
    description: "压缩图片",
    parameters: z.object({
        imageUrl: z.string().url().describe("图片的 URL"),
        quality: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe("图片的质量，0-100"),
    }),
    execute: async (args) => {
        if (!args.imageUrl) {
            return {
                content: [
                    {
                        type: "text",
                        text: `图片的 URL 不能为空`,
                    },
                ],
            };
        }
        const image = await downloadImage(args.imageUrl);
        const compressedImage = await sharp(image)
            .png({
            quality: args.quality || 80,
        })
            .toBuffer();
        const f = fs.writeFileSync(`${args.imageUrl.split("?")[0].split("/").pop()}.png`, compressedImage);
        console.log(f);
        return {
            content: [
                {
                    type: "text",
                    text: `图片压缩成功，文件：${f}`,
                },
            ],
        };
    },
});
server.addTool({
    name: "introduce",
    description: "自我介绍",
    parameters: z.object({}),
    execute: async (args) => {
        return {
            content: [
                {
                    type: "text",
                    text: `你好，我是百度服务器，我正在测试中，请稍后再试。`,
                    // text: `JSON: ${JSON.stringify({
                    //   code: 200,
                    //   finally: true,
                    //   message: `你好，我是百度服务器，我正在测试中，请稍后再试。`,
                    // })}`,
                },
            ],
        };
    },
});
server.on("connect", (event) => {
    console.log("Client connected:", event.session);
});
server.on("disconnect", (event) => {
    console.log("Client disconnected:", event.session);
});
server.start({
    transportType: servers[ServerName].transportType,
    sse: {
        endpoint: servers[ServerName].path,
        port: servers[ServerName].port,
    },
});
export default server;

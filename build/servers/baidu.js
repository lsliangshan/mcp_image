import { FastMCP } from "fastmcp";
import { z } from "zod";
import { servers } from "../config/index.js";
const server = new FastMCP({
    name: servers.baidu.name,
    version: servers.baidu.version,
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
    transportType: servers.baidu.transportType,
    sse: {
        endpoint: servers.baidu.path,
        port: servers.baidu.port,
    },
});
export default server;

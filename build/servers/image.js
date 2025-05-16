import { FastMCP } from "fastmcp";
import { z } from "zod";
import { servers } from "../config/index.js";
import { clipImageWithRoundedCorners, compressJpg, compressPng, compressWebp, convertImageFormat, downloadImage, removeImageBackground, } from "../utils/image.js";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { tmpdir } from "os";
import { getRandomId } from "../utils/random.js";
import { upload } from "../services/qiniu.js";
import { formatBytes } from "../utils/index.js";
const ServerName = "image";
const server = new FastMCP({
    name: servers[ServerName].name,
    version: servers[ServerName].version,
});
server.addTool({
    name: "tinyImage",
    description: "压缩图片",
    parameters: z.object({
        // imageUrl: z.string().url().describe("图片的 URL"),
        imageUrl: z.array(z.string().url()).describe("图片的 URL 列表"),
        quality: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe("图片的质量，0-100"),
    }),
    execute: async (args) => {
        if (!args.imageUrl || args.imageUrl.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `图片的 URL 不能为空`,
                    },
                ],
            };
        }
        const succeedUploads = [];
        const failedUploads = [];
        const downloadPs = [];
        args.imageUrl.forEach((url) => {
            downloadPs.push(downloadImage(url));
        });
        const images = await Promise.all(downloadPs);
        const outputs = [];
        const allImages = {
            png: [],
            webp: [],
            other: [],
        };
        for (const image of images) {
            const output = resolve(tmpdir(), `${image.split(".")[0]}-${getRandomId()}.${image.split(".").pop()}`);
            if (image.endsWith(".png")) {
                allImages.png.push({
                    input: image,
                    output,
                });
            }
            else if (image.endsWith(".webp")) {
                allImages.webp.push({
                    input: image,
                    output,
                });
            }
            else {
                allImages.other.push({
                    input: image,
                    output,
                });
            }
            outputs.push(output);
        }
        const pngCompressPs = [];
        const webpCompressPs = [];
        const otherCompressPs = [];
        allImages.png.forEach(({ input, output }) => {
            pngCompressPs.push(compressPng({
                input,
                output,
                quality: args.quality || 65,
            }));
        });
        allImages.webp.forEach(({ input, output }) => {
            webpCompressPs.push(compressWebp({
                input,
                output,
                quality: args.quality || 80,
            }));
        });
        allImages.other.forEach(({ input, output }) => {
            otherCompressPs.push(compressJpg({
                input,
                output,
                quality: args.quality || 60,
            }));
        });
        const compressPs = [
            ...pngCompressPs,
            ...webpCompressPs,
            ...otherCompressPs,
        ];
        try {
            const p = await Promise.allSettled(compressPs);
            p.forEach((item, index) => {
                if (item.status === "rejected") {
                    failedUploads.push({
                        original: images[index],
                        input: outputs[index],
                        output: "",
                    });
                }
            });
        }
        catch (_) { }
        const flatImages = allImages.png.concat(allImages.webp, allImages.other);
        const uploadPs = [];
        flatImages.forEach(({ input, output }) => {
            if (existsSync(output)) {
                uploadPs.push(upload({
                    url: output,
                    deleteAfterDays: 30,
                }));
            }
            else {
                const idx = failedUploads.findIndex(({ input: ipt }) => ipt === output);
                if (idx < 0) {
                    failedUploads.push({ original: input, input: output, output: "" });
                }
            }
        });
        const uploadResponses = await Promise.all(uploadPs);
        uploadResponses.forEach((uploadResponse) => {
            const originalIdx = flatImages.findIndex(({ output: opt }) => opt === uploadResponse.data.originalUrl);
            const original = originalIdx > -1 ? flatImages[originalIdx].input : "";
            if (uploadResponse.code === 200) {
                succeedUploads.push({
                    original,
                    input: uploadResponse.data.originalUrl,
                    output: uploadResponse.data.url,
                });
            }
            else {
                const idx = failedUploads.findIndex(({ input }) => input === uploadResponse.data.originalUrl);
                if (idx < 0) {
                    failedUploads.push({
                        original,
                        input: uploadResponse.data.originalUrl,
                        output: "",
                    });
                }
            }
        });
        let resText = succeedUploads.length > 0
            ? "图片压缩成功，请查看：\n"
            : "图片压缩失败，请稍后再试。";
        succeedUploads.forEach((item) => {
            const originSize = statSync(item.original).size;
            const newSize = statSync(item.input).size;
            const saveSize = originSize - newSize;
            const saveRate = (saveSize / originSize) * 100;
            resText += `压缩后图片地址：${item.output}，原图大小：${formatBytes(originSize)}，压缩后大小：${formatBytes(newSize)}，压缩比例：${saveRate.toFixed(2)}%\n`;
        });
        failedUploads.forEach((item) => {
            resText += `压缩失败图片地址：${item.input}\n`;
        });
        return {
            content: [
                {
                    type: "text",
                    text: resText,
                },
            ],
        };
    },
});
server.addTool({
    name: "roundedImage",
    description: "图片切圆角",
    annotations: {
        title: "将图片切圆角",
    },
    parameters: z.object({
        imageUrl: z.string().url().describe("图片的 URL"),
        radius: z.number().min(0).optional().describe("圆角的大小，单位：px"),
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
        const output = resolve(tmpdir(), `${image.split(".")[0]}-${getRandomId()}.png`);
        await clipImageWithRoundedCorners({
            input: image,
            output,
            radius: args.radius || 20,
        });
        if (existsSync(output)) {
            const uploadResponse = await upload({
                url: output,
                deleteAfterDays: 30,
            });
            if (uploadResponse.code === 200 && uploadResponse.data) {
                return `图片切圆角成功，请查看：${uploadResponse.data.url}`;
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: uploadResponse.message || `图片切圆角失败，请稍后再试。`,
                        },
                    ],
                };
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: `图片切圆角失败`,
                },
            ],
        };
    },
});
server.addTool({
    name: "convertImageFormat",
    description: "图片格式转换",
    annotations: {
        title: "将图片 {{image url}} 转换为 ico 格式",
    },
    parameters: z.object({
        imageUrl: z.string().url().describe("图片的 URL"),
        format: z
            .enum([
            "ico",
            "icns",
            "jpeg",
            "jpg",
            "png",
            "webp",
            "gif",
            "heic",
            "heif",
            "avif",
            "jpe",
            "tile",
            "dz",
            "raw",
            "tiff",
            "tif",
            "jp2",
            "jpx",
            "j2k",
            "j2c",
            "jxl",
        ])
            .optional()
            .describe("图片的格式"),
        quality: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe("图片的质量，0-100"),
        multiple: z
            .boolean()
            .optional()
            .default(false)
            .describe("是否多张，输出格式为ico或icns时有效"),
        size: z
            .array(z.number())
            .optional()
            .describe("图片的大小，单位：px，输出格式为ico或icns时有效"),
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
        // console.log("......", args);
        // return {
        //   content: [
        //     {
        //       type: "text",
        //       text: `图片格式转换成功`,
        //     },
        //   ],
        // };
        const image = await downloadImage(args.imageUrl);
        const output = resolve(tmpdir(), `${image.split(".")[0]}-${getRandomId()}.${args.format}`);
        let multiple = args.multiple;
        if (args.size && args.size.length > 0) {
            multiple = false;
        }
        try {
            await convertImageFormat({
                input: image,
                output,
                format: args.format || "jpeg",
                quality: args.quality || 100,
                multiple,
                size: args.size,
            });
            if (existsSync(output)) {
                const uploadResponse = await upload({
                    url: output,
                    deleteAfterDays: 30,
                    deleteSource: true,
                });
                if (uploadResponse.code === 200 && uploadResponse.data) {
                    return `图片格式转换成功，请查看：${uploadResponse.data.url}`;
                }
                else {
                    return {
                        content: [
                            {
                                type: "text",
                                text: uploadResponse.message || `图片格式转换失败，请稍后再试。`,
                            },
                        ],
                    };
                }
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `图片格式转换失败`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: error.message || `图片格式转换失败`,
                    },
                ],
            };
        }
    },
});
server.addTool({
    name: "removeImageBackground",
    description: "移除图片背景",
    annotations: {
        title: "移除图片 {{image url}} 的背景",
    },
    parameters: z.object({
        imageUrl: z.string().url().describe("图片的 URL"),
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
        const output = resolve(tmpdir(), `${image.split(".")[0]}-${getRandomId()}.png`);
        await removeImageBackground({
            input: image,
            output,
        });
        if (existsSync(output)) {
            const uploadResponse = await upload({
                url: output,
                deleteAfterDays: 30,
            });
            if (uploadResponse.code === 200 && uploadResponse.data) {
                return `图片背景移除成功，请查看：${uploadResponse.data.url}`;
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: uploadResponse.message || `图片背景移除失败，请稍后再试。`,
                        },
                    ],
                };
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: `图片背景移除失败`,
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
                    text: `你好，我是一个图片服务助手，具有图片压缩、图片格式转换、图片切圆角、移除图片背景等功能。`,
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

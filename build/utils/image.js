import { exec } from "child_process";
import { copyFile, existsSync, statSync, unlinkSync, writeFileSync, } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import pngquant from "pngquant-bin";
import sharp from "sharp";
/**
 * 下载图片
 * @param imageUrl 图片的URL
 * @returns 图片的Buffer
 */
export async function downloadImage(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const output = resolve(tmpdir(), `${imageUrl.split("?")[0].split("/").pop()}.${blob.type.split("/")[1]}`);
    writeFileSync(output, Buffer.from(await blob.arrayBuffer()));
    return output;
}
/**
 * 删除文件
 * @param filePath 文件的路径
 */
export function removeFile(filePath) {
    if (existsSync(filePath)) {
        unlinkSync(filePath);
    }
}
/**
 * 获取图片的扩展名
 * @param imageUrl 图片的URL
 * @returns 图片的扩展名
 */
export async function getImageExtension(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return blob.type.split("/")[1];
}
/**
 * 获取图片的格式
 * @param imageUrl 图片的URL
 * @returns 图片的格式
 */
export async function getImageFormat(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return blob.type;
}
/**
 * 获取图片的大小
 * @param imageUrl 图片的URL
 * @returns 图片的大小
 */
export async function getImageSize(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return { width: blob.size, height: blob.size };
}
export async function compressPng(params) {
    try {
        // 校验输入文件是否存在
        if (!existsSync(params.input)) {
            throw new Error("输入文件不存在");
        }
        const args = [
            "--quality",
            params.quality || "65-90",
            "--speed",
            params.speed || "1", // 调整速度平衡 (1=慢但质量好，3=平衡值)
            params.strip ? "--strip" : "", // 移除元数据
            "--output",
            params.output, // 明确输出路径
            "--", // 参数终止符
            params.input,
        ];
        // 使用异步执行 + 内存限制
        await new Promise((resolve, reject) => {
            // const child =
            exec(`"${pngquant}" ${args.join(" ")}`, {
                maxBuffer: params.maxBuffer || 1024 * 1024 * 100, // 100MB 缓冲区
                timeout: params.timeout || 60000, // 60秒超时
            }, (error) => {
                if (error?.code === 99) {
                    // 特殊错误码处理 (压缩后文件更大)
                    // console.warn("压缩后体积未减小，保留原文件");
                    copyFile(params.input, params.output, () => resolve(true));
                }
                else if (error) {
                    reject(error);
                }
                else {
                    resolve(true);
                }
            });
            // 实时日志输出
            // child.stdout?.on("data", console.log);
            // child.stderr?.on("data", console.error);
        });
        // 校验输出文件
        const stats = await statSync(params.output);
        if (stats.size === 0)
            throw new Error("生成空文件");
        return params.output;
    }
    catch (error) {
        // 异常时尝试回退到 sharp 压缩
        // console.error("pngquant 压缩失败，尝试 sharp 回退:", error);
        return fallbackSharpCompress(params);
    }
}
// Sharp 回退方案
async function fallbackSharpCompress(params) {
    return sharp(params.input)
        .png({
        quality: 80,
        compressionLevel: 9,
        adaptiveFiltering: true,
    })
        .toFile(params.output);
}
export async function compressWebp(params) {
    return sharp(params.input)
        .webp({
        quality: params.quality || 80,
    })
        .toFile(params.output);
}
async function compressJpg(params) {
    // 获取原始图片元数据
    const metadata = await sharp(params.input).metadata();
    console.log(">>>", metadata);
    if (metadata.format === "webp") {
        return compressWebp(params);
    }
    // 动态压缩参数
    const compressionParams = {
        quality: params.quality || 60, // 智能质量
        mozjpeg: true, // 启用高级压缩算法
        chromaSubsampling: "4:2:0", // 强制色度子采样
        trellisQuantisation: true, // 网格量化（体积优化）
        overshootDeringing: true, // 消除振铃效应
        optimiseScans: true, // 优化渐进式扫描
        progressive: true, // 生成渐进式JPEG
        force: true, // 强制JPEG输出
    };
    // 清除所有元数据（关键步骤）
    return sharp(params.input)
        .withMetadata({
        orientation: undefined, // 清除方向标签
        exif: {
            // 选择性保留必要元数据
            IFD0: {
                powered: "@liangqy @2025",
                //   Copyright: metadata.exif?.IFD0?.Copyright, // 保留版权信息
            },
        },
    })
        .jpeg(compressionParams)
        .toFile(params.output);
}

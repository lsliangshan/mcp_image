import { exec, execSync } from "child_process";
import {
  access,
  copyFile,
  existsSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { basename, resolve as pathResolve } from "path";
import pngquant from "pngquant-bin";
import sharp from "sharp";
import icongen from "icon-gen";
import { removeBackground } from "@imgly/background-removal-node";

/**
 * 下载图片
 * @param imageUrl 图片的URL
 * @returns 图片的Buffer
 */
export async function downloadImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  const output = pathResolve(
    tmpdir(),
    `${imageUrl.split("?")[0].split("/").pop()}.${blob.type.split("/")[1]}`
  );

  if (existsSync(output)) {
    unlinkSync(output);
  }
  writeFileSync(output, Buffer.from(await blob.arrayBuffer()));

  return output;
}

/**
 * 删除文件
 * @param filePath 文件的路径
 */
export function removeFile(filePath: string) {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * 获取图片的扩展名
 * @param imageUrl 图片的URL
 * @returns 图片的扩展名
 */
export async function getImageExtension(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return blob.type.split("/")[1];
}

/**
 * 获取图片的格式
 * @param imageUrl 图片的URL
 * @returns 图片的格式
 */
export async function getImageFormat(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return blob.type;
}

/**
 * 获取图片的大小
 * @param imageUrl 图片的URL
 * @returns 图片的大小
 */
export async function getImageSize(
  imageUrl: string
): Promise<{ width: number; height: number }> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return { width: blob.size, height: blob.size };
}

export async function compressPng(params: {
  input: string;
  output: string;
  quality?: number;
  speed?: number;
  strip?: boolean;
  maxBuffer?: number;
  timeout?: number;
}) {
  // 校验输入文件是否存在
  if (!existsSync(params.input)) {
    throw new Error("输入文件不存在");
  }
  try {
    const args = [
      "--quality",
      params.quality || 65,
      "--speed",
      params.speed || 1, // 调整速度平衡 (1=慢但质量好，3=平衡值)
      params.strip ? "--strip" : "", // 移除元数据
      "--output",
      params.output, // 明确输出路径
      "--", // 参数终止符
      params.input,
    ];

    // 使用异步执行 + 内存限制
    await new Promise((resolve, reject) => {
      // const child =
      exec(
        `"${pngquant}" ${args.join(" ")}`,
        {
          maxBuffer: params.maxBuffer || 1024 * 1024 * 100, // 100MB 缓冲区
          timeout: params.timeout || 60000, // 60秒超时
        },
        (error) => {
          if (error?.code === 99) {
            // 特殊错误码处理 (压缩后文件更大)
            // console.warn("压缩后体积未减小，保留原文件");
            copyFile(params.input, params.output, () => resolve(true));
          } else if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        }
      );

      // 实时日志输出
      // child.stdout?.on("data", console.log);
      // child.stderr?.on("data", console.error);
    });

    // 校验输出文件
    const stats = await statSync(params.output);
    if (stats.size === 0) throw new Error("生成空文件");

    return params.output;
  } catch (error) {
    // 异常时尝试回退到 sharp 压缩
    // console.error("pngquant 压缩失败，尝试 sharp 回退:", error);
    return fallbackSharpCompress(params);
  }
}

// Sharp 回退方案
async function fallbackSharpCompress(params: {
  input: string;
  output: string;
}) {
  return sharp(params.input)
    .png({
      quality: 80,
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toFile(params.output);
}

export async function compressWebp(params: {
  input: string;
  output: string;
  quality?: number;
}) {
  return sharp(params.input)
    .webp({
      quality: params.quality || 80,
    })
    .toFile(params.output);
}

export async function compressJpg(params: {
  input: string;
  output: string;
  quality?: number;
}) {
  // 获取原始图片元数据
  const metadata = await sharp(params.input).metadata();

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
          //   Copyright: metadata.exif?.IFD0?.Copyright, // 保留版权信息
        },
      },
    })
    .jpeg(compressionParams)
    .toFile(params.output);
}

/**
 * 裁剪图片并添加圆角
 * @param params 裁剪参数
 * @returns 裁剪后的图片路径
 */
export async function clipImageWithRoundedCorners(params: {
  input: string;
  output: string;
  radius?: number;
}) {
  try {
    // 读取原始JPEG图像
    const image = sharp(params.input);
    const { width, height } = await image.metadata();

    const svgMask = `
      <svg width="${width}" height="${height}">
        <rect x="0" y="0" 
              width="${width}" 
              height="${height}"
              rx="${params.radius || 20}" 
              ry="${params.radius || 20}"
              fill="white"/>
      </svg>
    `;

    // 处理图像并应用透明圆角
    await image
      .ensureAlpha() // 强制添加透明通道
      .composite([{ input: Buffer.from(svgMask), blend: "dest-in" }])
      .png({
        quality: 100, // PNG质量（1-100）
        compressionLevel: 9, // 最高压缩率
        adaptiveFiltering: true, // 启用自适应过滤
      })
      .toFile(params.output);
  } catch (error) {
    throw error;
  }
}

function getIcoOrIcnsSizes(params: {
  format: string;
  sizes: number[];
}): number[] {
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
  let sizes: number[] = [];
  if (params.format === "ico") {
    params.sizes.forEach((size) => {
      if (icoSizes.includes(size)) {
        sizes.push(size);
      } else {
        const index = icoSizes.findIndex((s) => s > size);
        sizes =
          index === -1 ? [icoSizes[icoSizes.length - 1]] : [icoSizes[index]];
      }
    });
  } else if (params.format === "icns") {
    params.sizes.forEach((size) => {
      if (icnsSizes.includes(size)) {
        sizes.push(size);
      } else {
        const index = icnsSizes.findIndex((s) => s > size);
        sizes =
          index === -1 ? [icnsSizes[icnsSizes.length - 1]] : [icnsSizes[index]];
      }
    });
  }
  return Array.from(new Set(sizes));
}

async function toIcoOrIcnsImage(params: {
  input: string;
  output: string;
  multiple?: boolean;
  size?: number[];
}) {
  return new Promise(async (resolve, reject) => {
    const [outputFileName, outputFormat] = basename(params.output).split(".");
    const options: {
      report: boolean;
      ico?: {
        name: string;
        sizes: number[];
      };
      icns?: {
        name: string;
        sizes: number[];
      };
    } = {
      report: false,
    };

    let sizes: number[] = [];
    if (!params.multiple) {
      if (params.size) {
        sizes = Array.isArray(params.size) ? params.size : [params.size];
      } else {
        const { width } = await sharp(params.input).metadata();
        sizes = [width || 1024];
      }
    } else {
      sizes = [];
    }
    if (outputFormat === "ico") {
      options.ico = {
        name: outputFileName,
        sizes:
          sizes.length !== 0
            ? getIcoOrIcnsSizes({ sizes: sizes, format: "ico" })
            : [16, 24, 32, 48, 64, 128, 256],
      };
    } else if (outputFormat === "icns") {
      options.icns = {
        name: outputFileName,
        sizes:
          sizes.length !== 0
            ? getIcoOrIcnsSizes({ sizes: sizes, format: "icns" })
            : [16, 32, 64, 128, 256, 512, 1024],
      };
    }

    await icongen(params.input, pathResolve(params.output, ".."), options)
      .then((res: any) => {
        resolve(res);
      })
      .catch((err: any) => {
        reject(err);
      });
  });
}

/**
 * 格式化图片
 * @param params 格式化参数
 * @param {string} params.input 输入图片路径
 * @param {string} params.output 输出图片路径
 * @param {string} params.format 输出格式
 * @param {number} [params.quality] 输出质量
 * @param {boolean} [params.multiple] 是否多张
 * @param {number | number[]} [params.size] 输出大小
 * @returns 格式化后的图片路径
 */
export async function convertImageFormat(params: {
  input: string;
  output: string;
  format: string;
  quality?: number;
  multiple?: boolean;
  size?: number[];
}) {
  try {
    if (params.format === "ico" || params.format === "icns") {
      await toIcoOrIcnsImage(params);
      return;
    }

    await sharp(params.input)
      .toFormat((params.format || "jpeg") as keyof sharp.FormatEnum, {
        quality: params.quality || 100,
        compressionLevel: 9,
        lossless: true,
      })
      .toFile(params.output);
  } catch (error) {
    throw error;
  }
}

/**
 * 移除图片背景
 * @param params 移除背景参数
 * @param {string} params.input 输入图片路径
 * @param {string} params.output 输出图片路径
 * @returns 移除背景后的图片路径
 */
export async function removeImageBackground(params: {
  input: string;
  output: string;
}) {
  const image = await removeBackground(params.input);

  const buffer = Buffer.from(await image.arrayBuffer());

  writeFileSync(params.output, buffer);
}

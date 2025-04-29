import { execSync, exec } from "child_process";
import pngquant from "pngquant-bin";
import os from "os";
import { writeFileSync, unlinkSync, access, copyFile, statSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

async function downloadImage(imageUrl) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const output = resolve(
    os.tmpdir(),
    `${imageUrl.split("?")[0].split("/").pop()}.${blob.type.split("/")[1]}`
  );
  writeFileSync(output, Buffer.from(await blob.arrayBuffer()));

  return output;
}

// downloadImage(
//   "https://img2.baidu.com/it/u=647265987,1253183144&fm=253&fmt=auto&app=138&f=JPEG?w=800&h=500"
// ).then((res) => {
//   console.log(">>>", res);
// });

// unlinkSync(
//   "/var/folders/gc/bnd3dwq906x57tffhvb3bkgh0000gn/T/u=647265987,1253183144&fm=253&fmt=auto&app=138&f=JPEG.jpeg"
// );

async function pngquantCompress(params) {
  try {
    // 校验输入文件是否存在
    // await access(params.input);

    const args = [
      "--quality",
      params.quality || "65-90",
      "--speed",
      "1", // 调整速度平衡 (1=慢但质量好，3=平衡值)
      "--strip", // 移除元数据
      "--output",
      params.output, // 明确输出路径
      "--", // 参数终止符
      params.input,
    ];

    // 使用异步执行 + 内存限制
    await new Promise((resolve, reject) => {
      const child = exec(
        `"${pngquant}" ${args.join(" ")}`,
        {
          maxBuffer: 1024 * 1024 * 100, // 100MB 缓冲区
          timeout: 60000, // 60秒超时
        },
        (error) => {
          if (error?.code === 99) {
            // 特殊错误码处理 (压缩后文件更大)
            // console.warn("压缩后体积未减小，保留原文件");
            copyFile(params.input, params.output, () => resolve());
          } else if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );

      // 实时日志输出
      child.stdout?.on("data", console.log);
      child.stderr?.on("data", console.error);
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
async function fallbackSharpCompress(params) {
  return sharp(params.input)
    .png({
      quality: 80,
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toFile(params.output);
}

function compressWebp(params) {
  return sharp(params.input)
    .webp({
      quality: params.quality || 60,
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
          title: "new title",
          //   Copyright: metadata.exif?.IFD0?.Copyright, // 保留版权信息
        },
      },
    })
    .jpeg(compressionParams)
    .toFile(params.output);
}

// compressJpg({
//   input: "/Users/liangshan/Downloads/图片/5.jpg",
//   output: "/Users/liangshan/Downloads/图片/5-cc.jpg",
//   //   quality: 80,
// });

// pngquantCompress({
//   input: "/Users/liangshan/Downloads/图片/3.webp",
//   output: "/Users/liangshan/Downloads/图片/133333.webp",
//   quality: "65-90",
// });

// compressWebp({
//   input: "/Users/liangshan/Downloads/图片/3.webp",
//   output: "/Users/liangshan/Downloads/图片/233333.webp",
// });

async function getMetadata(params) {
  const metadata = await sharp(params.input).metadata();

  // const decoder = new TextDecoder("utf-8");
  // const s = decoder.decode(metadata.exif?.slice(4) || Buffer.from(""));
  console.log("11>>>", metadata.exif?.toLocaleString());
}

// getMetadata({
//   input: "/Users/liangshan/Downloads/图片/1.png",
// });
// getMetadata({
//   input: "/Users/liangshan/Downloads/图片/2.png",
// });
// getMetadata({
//   input: "/Users/liangshan/Downloads/图片/3.webp",
// });
// getMetadata({
//   input: "/Users/liangshan/Downloads/图片/4.jpeg",
// });
// getMetadata({
//   input: "/Users/liangshan/Downloads/图片/5.jpg",
// });
getMetadata({
  input: "/Users/liangshan/Downloads/图片/5-cc.jpg",
});

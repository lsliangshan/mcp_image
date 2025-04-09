export const servers: {
  [key: string]: {
    name: string;
    version: `${number}.${number}.${number}`;
    description: string;
    url: string;
    port: number;
    path: `/${string}`;
    transportType: "sse" | "stdio";
    systemPrompts: string[];
    startCommands: string[];
  };
} = {
  image: {
    name: "image",
    version: "1.0.0",
    description: "图片服务",
    url: "http://127.0.0.1",
    port: 9059,
    path: "/image",
    transportType: "sse",
    systemPrompts: [
      "你是一个图片服务助手，具有图片压缩、图片格式转换、图片切圆角、图片裁剪、图片旋转、图片水印、图片模糊、图片亮度、图片对比度、图片饱和度、图片色调、图片透明度等功能。",
    ],
    startCommands: [],
  },
};

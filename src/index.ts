// import { servers } from "./config/index.js";

// for (const server of Object.values(servers)) {
//   import(`./servers/${server.name}.js`).then((module) => {
//     module.default.start({
//       transportType: "sse",
//       sse: {
//         endpoint: server.path,
//         port: server.port,
//       },
//     });
//   });
// }

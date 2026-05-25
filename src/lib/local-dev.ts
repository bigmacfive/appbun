import { Socket } from "node:net";

const COMMON_LOCAL_PORTS = [3000, 5173, 4173, 8080, 8000, 5000, 5174, 4321] as const;

export async function discoverLocalWebApp(): Promise<string | undefined> {
  for (const port of COMMON_LOCAL_PORTS) {
    if (await isPortOpen(port)) {
      return `http://localhost:${port}`;
    }
  }
  return undefined;
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket: Socket = new Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(350);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

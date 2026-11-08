import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

// LAN dev config: binds to the network so a phone on the same Wi-Fi can open the site.
export default defineConfig(mergeConfig(baseConfig, { server: { host: true } }));

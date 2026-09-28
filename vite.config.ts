import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
export default defineConfig({
  base:"./",
  plugins:[react()],
  resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))}},
  build:{outDir:"dist",emptyOutDir:true,rollupOptions:{input:{index:fileURLToPath(new URL("./index.html",import.meta.url)),premarket:fileURLToPath(new URL("./premarket.html",import.meta.url))}}}
});

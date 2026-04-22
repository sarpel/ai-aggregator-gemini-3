import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
	return {
		server: {
			port: 3000,
			host: "0.0.0.0",
			proxy: {
				"/api": {
					target: "http://localhost:3001",
					changeOrigin: true,
				},
			},
		},
		plugins: [react()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "."),
			},
		},
	};
});

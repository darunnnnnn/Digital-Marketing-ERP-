import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so a lockfile elsewhere on the machine is ignored.
  outputFileTracingRoot: here,
  // Lets a verification build run beside `npm run dev` without touching its
  // `.next` folder: NEXT_DIST_DIR=.next-verify next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

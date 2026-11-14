import path from "node:path";

/** @type {import('next').NextConfig} */
const config = {
    output: "export",
    trailingSlash: true,
    images: {unoptimized: true},
    reactStrictMode: true,
    outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
};

export default config;

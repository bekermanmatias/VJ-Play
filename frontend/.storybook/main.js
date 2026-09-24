import path from "node:path";
import { fileURLToPath } from "node:url";
import { react } from "@storybook-astro/framework/integrations";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  staticDirs: ["../public"],
  framework: { name: "@storybook-astro/framework", options: { integrations: [react({ include: ["**/components/news/**", "**/components/ui/**/*.tsx"] })] } },
  async viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = { ...config.resolve.alias, "@": path.resolve(dirname, "../src") };
    return config;
  },
};

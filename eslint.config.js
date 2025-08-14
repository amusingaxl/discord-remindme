import js from "@eslint/js";
import { flatConfigs as importConfigs } from "eslint-plugin-import";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
    js.configs.recommended,
    importConfigs.recommended,
    prettierRecommended,
    {
        rules: {},
        languageOptions: {
            ecmaVersion: "latest",
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
    },
    {
        ignores: ["node_modules/**", "dist/**", "build/**", "*.sqlite", "*.db"],
    },
];

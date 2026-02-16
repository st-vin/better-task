// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
    { ignores: ["main.js", "main.js.map"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        plugins: {
            obsidianmd: obsidianmd,
        },
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "obsidianmd/sample-names": "off",
            "obsidianmd/prefer-file-manager-trash-file": "error",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { args: "none" }],
            "@typescript-eslint/no-explicit-any": "error",
        },
    }
);

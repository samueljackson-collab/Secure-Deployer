import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";

export default [
  {
    languageOptions: { globals: globals.browser },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ignores: ["dist/**", "eslint.config.js"],
  },
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    rules: {
      ...pluginReactConfig.rules,
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/display-name": "off",
    }
  }
];

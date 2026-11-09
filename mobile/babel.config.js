module.exports = function (api) {
  api.cache(true);
  return {
    plugins: [require.resolve("./scripts/babel-localize.cjs")],
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};

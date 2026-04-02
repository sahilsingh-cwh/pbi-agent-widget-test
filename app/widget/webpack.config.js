const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/visual.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "visual.js",
    library: {
      name: "powerbi",
      type: "umd",
    },
    globalObject: "self",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: ["ts-loader"],
      },
    ],
  },
  externals: {
    "powerbi-visuals-api": "powerbi-visuals-api",
  },
};

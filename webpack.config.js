const path = require('path');
const webpack = require('webpack');

const getClientEnv = () => Object.fromEntries(Object.entries(require('dotenv').config().parsed).filter(([key]) => key.startsWith('CLIENT_')));

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'public'),
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(getClientEnv())
    })
  ],
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },
  mode: "production"
};
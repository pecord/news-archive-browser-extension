const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: {
      background: './src/background.js',
      content: './src/content.js',
      popup: './src/popup.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: { chrome: '110' } }],
              ],
            },
          },
        },
      ],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: '.' },
          { from: 'src/ui/popup.html', to: 'ui/popup.html' },
          { from: 'src/ui/popup.css', to: 'ui/popup.css' },
          { from: 'icons', to: 'icons', globOptions: { ignore: ['**/*.js'] } },
        ],
      }),
    ],
    optimization: {
      minimizer: isProd ? [new TerserPlugin()] : [],
    },
    devtool: isProd ? false : 'cheap-module-source-map',
  };
};

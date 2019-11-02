const path = require('path');
const webpack = require('webpack');
const { createRefreshTemplate, injectRefreshEntry } = require('./helpers');
const { runtimeUtils } = require('./runtime/globals');

class ReactRefreshPlugin {
  /**
   * @param {*} [options] Options for react-refresh-plugin.
   * @param {boolean} [options.forceEnable] A flag to enable the plugin forcefully.
   * @returns {void}
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Applies the plugin
   * @param {import('webpack').Compiler} compiler A webpack compiler object.
   * @returns {void}
   */
  apply(compiler) {
    // Webpack does not set process.env.NODE_ENV
    // Ref: https://github.com/webpack/webpack/issues/7074
    // Skip processing on non-development mode, but allow manual force-enabling
    if (compiler.options.mode !== 'development' && !this.options.forceEnable) {
      return;
    }

    // Inject react-refresh context to all Webpack entry points
    compiler.options.entry = injectRefreshEntry(compiler.options.entry);

    // Inject refresh utilities to Webpack's global scope
    const providePlugin = new webpack.ProvidePlugin({
      [runtimeUtils]: require.resolve('./runtime/utils'),
    });
    providePlugin.apply(compiler);

    compiler.hooks.beforeRun.tap(this.constructor.name, compiler => {
      // Check for existence of HotModuleReplacementPlugin in the plugin list
      // It is the foundation to this plugin working correctly
      if (
        !compiler.options.plugins.find(
          // It's validated with the name rather than the constructor reference
          // because a project might contain multiple references to Webpack
          plugin => plugin.constructor.name === 'HotModuleReplacementPlugin'
        )
      ) {
        throw new Error(
          'Hot Module Replacement (HMR) is not enabled! React-refresh requires HMR to function properly.'
        );
      }
    });

    compiler.hooks.normalModuleFactory.tap(this.constructor.name, nmf => {
      nmf.hooks.afterResolve.tap(this.constructor.name, data => {
        // Inject refresh loader to all JavaScript-like files
        if (
          // Test for known (and popular) JavaScript-like extensions
          /\.([jt]sx?|flow)$/.test(data.resource) &&
          // Skip all files from node_modules
          !/node_modules/.test(data.resource) &&
          // Skip runtime refresh utilities (to prevent self-referencing)
          // This is useful when using the plugin as a direct dependency
          data.resource !== path.join(__dirname, './runtime/utils')
        ) {
          data.loaders.unshift(require.resolve('./loader'));
        }

        return data;
      });
    });

    compiler.hooks.compilation.tap(this.constructor.name, compilation => {
      compilation.mainTemplate.hooks.require.tap(
        this.constructor.name,
        // Constructs the correct module template for react-refresh
        createRefreshTemplate
      );
    });
  }
}

module.exports.ReactRefreshPlugin = ReactRefreshPlugin;
module.exports = ReactRefreshPlugin;
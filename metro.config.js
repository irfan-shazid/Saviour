const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The Better Auth server lives in server/ with its own package.json and
// node_modules. Metro watches the project root, so without this it tries to
// crawl (and sometimes resolve out of) the server's dependency tree.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  new RegExp(`^${path.resolve(__dirname, 'server').replace(/[\\/]/g, '[\\\\/]')}[\\\\/].*$`),
];

module.exports = config;

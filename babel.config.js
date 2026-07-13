module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'react',
          lazyImports: true,
        },
      ],
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};

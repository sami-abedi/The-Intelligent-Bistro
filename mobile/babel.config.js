module.exports = function (api) {
    api.cache(true);
    return {
      presets: [
        ["babel-preset-expo", { jsxImportSource: "nativewind" }],
        "nativewind/babel",
      ],
      plugins: [
        // Must be listed LAST. Required by react-native-reanimated v4
        // (which Expo SDK 54 ships); without it every worklet silently
        // no-ops on the JS thread and animations never run.
        "react-native-worklets/plugin",
      ],
    };
  };
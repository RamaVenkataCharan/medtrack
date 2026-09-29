export const Platform = {
  OS: 'node',
  select: (options) => options.node || options.default || options.web || options.ios || options.android,
};

export default {
  Platform,
};

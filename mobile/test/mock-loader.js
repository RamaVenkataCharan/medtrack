export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./mocks/react-native.js', import.meta.url).href,
    };
  }
  if (specifier === 'expo-secure-store') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./mocks/expo-secure-store.js', import.meta.url).href,
    };
  }
  if (specifier === '@react-native-community/netinfo') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./mocks/netinfo.js', import.meta.url).href,
    };
  }
  if (specifier === 'expo-notifications') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./mocks/expo-notifications.js', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}

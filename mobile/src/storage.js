import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveAuth(token, role) {
  await AsyncStorage.setItem("token", token);
  await AsyncStorage.setItem("role", role);
}

export async function loadAuth() {
  const token = await AsyncStorage.getItem("token");
  const role = await AsyncStorage.getItem("role");
  return { token, role };
}

export async function clearAuth() {
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("role");
}

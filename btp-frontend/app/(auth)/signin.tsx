import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
  Animated,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CheckCircle } from "lucide-react-native";

const API_URL = "http://10.101.102.178:5000/api/auth";

export default function SignIn() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const showSuccessMessage = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => router.replace("/(tabs)"));
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Login Failed", data.msg || "Invalid credentials");
        return;
      }

      await AsyncStorage.setItem("authToken", data.token);
      await AsyncStorage.setItem("user", JSON.stringify(data.user));

      showSuccessMessage();
    } catch (err) {
      Alert.alert("Error", "Network error, please try again");
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.successMessage, { opacity: fadeAnim }]}>
        <CheckCircle size={24} color="#fff" />
        <Text style={styles.successText}>Login Successful!</Text>
      </Animated.View>

      {!isSmallScreen && (
        <View style={styles.imageContainer}>
          <Image
            source={require("../../image/back.png")}
            style={styles.backgroundImage}
          />
          <View style={styles.overlay}></View>
        </View>
      )}

      <View style={[styles.content, !isSmallScreen && styles.contentWide]}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleSignIn}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Create an Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row" },
  imageContainer: { flex: 1 },
  backgroundImage: { flex: 1, resizeMode: "cover" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  contentWide: { maxWidth: 480, width: "100%", backgroundColor: "#fff" },
  header: { marginBottom: 48 },
  title: { fontSize: 32, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666" },
  form: { gap: 16 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#F8FAFC",
  },
  button: {
    height: 44,
    backgroundColor: "#FF1493",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: { color: "#333", fontSize: 16, fontWeight: "600" },
  successMessage: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  successText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

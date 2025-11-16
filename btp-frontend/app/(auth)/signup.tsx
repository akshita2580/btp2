import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";

const API_URL = "http://172.22.60.96:5000/api/auth"; // your backend

export default function SignUp() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    setError("");
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Sign Up", "Please fill all the fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Sign Up", "Passwords do not match");
      return;
    }

    try {
      const requestBody = { fullName, email, password };
      console.log("Sending signup request with body:", requestBody);
      
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log("Signup response status:", res.status);
      console.log("Signup response data:", data);

      if (!res.ok) {
        Alert.alert("Sign Up Error", data.msg || data.error || "Something went wrong");
        return;
      }

      Alert.alert("Success", "Account created successfully!", [
        { text: "OK", onPress: () => router.replace("/(auth)/signin") },
      ]);
    } catch (err) {
      console.error("Signup error:", err);
      Alert.alert("Sign Up Error", `Network error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <View style={styles.container}>
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join our community of safety-conscious individuals
          </Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#666"
            value={fullName}
            onChangeText={setFullName}
          />
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
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>

          <Link href="/(auth)/signin" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Sign In Instead</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  contentWide: { maxWidth: 480, width: "100%", backgroundColor: "#fff" },
  header: { marginBottom: 48 },
  title: { fontSize: 32, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666" },
  form: { gap: 16 },
  errorText: { color: "#DC2626", fontSize: 14 },
  input: {
    height: Platform.OS === "web" ? 52 : 44,
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
    marginTop: 8,
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
  secondaryButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
});

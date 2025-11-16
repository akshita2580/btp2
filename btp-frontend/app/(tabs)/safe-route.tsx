import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Route, AlertCircle } from 'lucide-react-native';

// Backend API URL - Update this to match your backend server
// For local development, use your machine's IP address
// For production, use your deployed backend URL
const API_BASE_URL = 'http://172.22.60.96:8000'; // Change to your server IP, e.g., 'http://192.168.1.100:8000'

interface RouteResponse {
  status: string;
  safe_path_distance_km?: number;
  crime_score?: number;
  map_url?: string;
  message?: string;
}

export default function SafeRouteScreen() {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFindRoute = async () => {
    if (!source.trim() || !destination.trim()) {
      Alert.alert('Error', 'Please enter both source and destination locations');
      return;
    }

    setLoading(true);
    setError(null);
    setMapUrl(null);
    setRouteData(null);

    try {
      const response = await fetch(`${API_BASE_URL}/getSafeRoute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: source.trim(),
          destination: destination.trim(),
        }),
      });

      const data: RouteResponse = await response.json();

      if (data.status === 'success' && data.map_url) {
        setMapUrl(data.map_url);
        setRouteData(data);
      } else {
        const errorMessage = data.message || 'Failed to find route';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect to server. Please check if the backend is running.';
      setError(errorMessage);
      Alert.alert(
        'Connection Error',
        errorMessage + '\n\nMake sure the Python backend is running on ' + API_BASE_URL,
        [
          { text: 'OK', style: 'default' },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSource('');
    setDestination('');
    setMapUrl(null);
    setRouteData(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Route size={24} color="#FF1493" />
          <Text style={styles.headerTitle}>Safe Route Detection</Text>
        </View>

        <ScrollView
          style={styles.inputContainer}
          contentContainerStyle={styles.inputContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Source Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Connaught Place, Delhi"
              value={source}
              onChangeText={setSource}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Destination Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., AIIMS, Delhi"
              value={destination}
              onChangeText={setDestination}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleFindRoute}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Find Safe Route</Text>
            )}
          </TouchableOpacity>

          {mapUrl && (
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={handleReset}
            >
              <Text style={styles.buttonText}>Reset</Text>
            </TouchableOpacity>
          )}

          {routeData && routeData.status === 'success' && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>
                  {routeData.safe_path_distance_km?.toFixed(2)} km
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Crime Score</Text>
                <Text style={styles.statValue}>
                  {routeData.crime_score?.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <AlertCircle size={20} color="#FF1493" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FF1493" />
            <Text style={styles.loadingText}>Finding safe route...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        )}

        {mapUrl && !loading && (
          <View style={styles.mapContainer}>
            <WebView
              source={{ uri: mapUrl }}
              style={styles.webview}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView error: ', nativeEvent);
                setError('Failed to load map. Please try again.');
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView HTTP error: ', nativeEvent);
                setError('Failed to load map. Please check the backend server.');
              }}
              renderError={() => (
                <View style={styles.errorView}>
                  <AlertCircle size={48} color="#FF1493" />
                  <Text style={styles.errorViewText}>
                    Failed to load map
                  </Text>
                  <Text style={styles.errorViewSubtext}>
                    Please check your connection and try again
                  </Text>
                </View>
              )}
            />
          </View>
        )}

        {!mapUrl && !loading && (
          <View style={styles.placeholderContainer}>
            <Route size={64} color="#E2E8F0" />
            <Text style={styles.placeholderText}>
              Enter source and destination to find the safest route
            </Text>
            <Text style={styles.placeholderSubtext}>
              The map will show safest (blue), fastest (green), and unsafe (red) routes
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  inputContainer: {
    flex: 0,
    maxHeight: 300,
  },
  inputContent: {
    padding: 20,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    fontFamily: 'Inter_400Regular',
  },
  button: {
    backgroundColor: '#FF1493',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resetButton: {
    backgroundColor: '#64748B',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 10,
  },
  statCard: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Inter_600SemiBold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Inter_600SemiBold',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  mapContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  errorViewText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Inter_600SemiBold',
  },
  errorViewSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
    fontFamily: 'Inter_400Regular',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8FAFC',
  },
  placeholderText: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  placeholderSubtext: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});


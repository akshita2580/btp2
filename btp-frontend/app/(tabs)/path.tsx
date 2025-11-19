import React, { useState, useEffect, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Route, Navigation, MapPin, AlertCircle, Play, Square } from 'lucide-react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';

// Try to import react-native-maps, fallback to WebView if not available
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
} catch (e) {
  console.log('react-native-maps not available, using WebView fallback');
}
import {
  haversine,
  calculateRouteDistance,
  findNearestPointOnRoute,
  calculateCoveredDistance,
  Coordinate,
} from '../../utils/geo';

// Backend API URL - Update this to match your backend server
const API_BASE_URL = 'http://10.101.102.178:8000';

interface PathResponse {
  status: string;
  safest_path: Coordinate[];
  fastest_path: Coordinate[];
  unsafe_path: Coordinate[];
  safest_distance_km: number;
  fastest_distance_km: number;
  unsafe_distance_km: number;
  source: [number, number];
  destination: [number, number];
  message?: string;
}

type RouteType = 'safest' | 'fastest' | 'unsafe';

export default function PathScreen() {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [pathData, setPathData] = useState<PathResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [selectedRoute, setSelectedRoute] = useState<RouteType>('safest');
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [distanceCovered, setDistanceCovered] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  const [percentCompleted, setPercentCompleted] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [useNativeMap, setUseNativeMap] = useState(true);

  const mapRef = useRef<any>(null);

  // Check if native maps is available
  useEffect(() => {
    if (Platform.OS === 'web' || !MapView) {
      setUseNativeMap(false);
    } else {
      setUseNativeMap(true);
    }
  }, []);

  // Fetch routes from backend
  const handleFindRoutes = async () => {
    if (!source.trim() || !destination.trim()) {
      Alert.alert('Error', 'Please enter both source and destination locations');
      return;
    }

    setLoading(true);
    setError(null);
    setPathData(null);
    setIsNavigating(false);
    stopNavigation();

    try {
      const response = await fetch(`${API_BASE_URL}/getPaths`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: source.trim(),
          destination: destination.trim(),
        }),
      });

      const data: PathResponse = await response.json();

      if (data.status === 'success') {
        setPathData(data);
        // Calculate initial remaining distance
        const currentRoute = getCurrentRoute(data);
        const totalDist = calculateRouteDistance(currentRoute);
        setDistanceRemaining(totalDist);
      } else {
        const errorMessage = data.message || 'Failed to find routes';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect to server. Please check if the backend is running.';
      setError(errorMessage);
      Alert.alert('Connection Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get current route based on selection
  const getCurrentRoute = (data: PathResponse | null): Coordinate[] => {
    if (!data) return [];
    switch (selectedRoute) {
      case 'safest':
        return data.safest_path;
      case 'fastest':
        return data.fastest_path;
      case 'unsafe':
        return data.unsafe_path;
      default:
        return data.safest_path;
    }
  };

  // Get current route distance
  const getCurrentRouteDistance = (): number => {
    if (!pathData) return 0;
    switch (selectedRoute) {
      case 'safest':
        return pathData.safest_distance_km || 0;
      case 'fastest':
        return pathData.fastest_distance_km || 0;
      case 'unsafe':
        return pathData.unsafe_distance_km || 0;
      default:
        return pathData.safest_distance_km || 0;
    }
  };

  // Request location permission and start tracking
  const startNavigation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required for navigation. Please enable it in settings.'
        );
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const initialCoord: Coordinate = [location.coords.latitude, location.coords.longitude];
      setUserLocation(initialCoord);

      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Update every 2 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const coord: Coordinate = [location.coords.latitude, location.coords.longitude];
          setUserLocation(coord);
          updateProgress(coord);
        }
      );

      setLocationSubscription(subscription);
      setIsNavigating(true);
    } catch (err: any) {
      Alert.alert('Error', `Failed to start navigation: ${err.message}`);
    }
  };

  // Stop navigation
  const stopNavigation = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    setIsNavigating(false);
    setDistanceCovered(0);
    setDistanceRemaining(getCurrentRouteDistance());
    setPercentCompleted(0);
    setIsOffRoute(false);
  };

  // Update progress based on user location
  const updateProgress = (userCoord: Coordinate) => {
    if (!pathData) return;

    const currentRoute = getCurrentRoute(pathData);
    if (currentRoute.length === 0) return;

    // Find nearest point on route
    const nearest = findNearestPointOnRoute(userCoord, currentRoute);
    const distanceFromRoute = nearest.distance * 1000; // Convert to meters

    // Check if off route (more than 50 meters)
    setIsOffRoute(distanceFromRoute > 50);

    // Calculate covered distance
    const covered = calculateCoveredDistance(userCoord, currentRoute);
    const total = calculateRouteDistance(currentRoute);
    const remaining = Math.max(0, total - covered);

    setDistanceCovered(covered);
    setDistanceRemaining(remaining);
    setPercentCompleted(total > 0 ? Math.min(100, (covered / total) * 100) : 0);

    // Update map camera to follow user
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: userCoord[0],
        longitude: userCoord[1],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Handle route selection change
  const handleRouteChange = (route: RouteType) => {
    setSelectedRoute(route);
    if (isNavigating) {
      // Recalculate progress with new route
      if (userLocation) {
        updateProgress(userLocation);
      }
    } else {
      // Reset distances
      const total = getCurrentRouteDistance();
      setDistanceRemaining(total);
      setDistanceCovered(0);
      setPercentCompleted(0);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopNavigation();
    };
  }, []);

  // Generate Leaflet map HTML for WebView fallback
  const generateMapHTML = (): string => {
    if (!pathData) return '';

    const currentRoute = getCurrentRoute(pathData);
    const routeColor = selectedRoute === 'safest' ? 'blue' : selectedRoute === 'fastest' ? 'green' : 'red';
    
    const routeCoords = currentRoute.map(([lat, lon]) => `[${lat}, ${lon}]`).join(',\n        ');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100%; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        const map = L.map('map').setView([${pathData.source[0]}, ${pathData.source[1]}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Route polyline
        const route = L.polyline([
            ${routeCoords}
        ], { color: '${routeColor}', weight: 5, opacity: 0.7 }).addTo(map);

        // Source marker
        L.marker([${pathData.source[0]}, ${pathData.source[1]}])
            .addTo(map)
            .bindPopup('Source');

        // Destination marker
        L.marker([${pathData.destination[0]}, ${pathData.destination[1]}])
            .addTo(map)
            .bindPopup('Destination');

        ${userLocation ? `
        // User location marker
        const userMarker = L.marker([${userLocation[0]}, ${userLocation[1]}], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
            })
        }).addTo(map);
        map.setView([${userLocation[0]}, ${userLocation[1]}], 15);
        ` : ''}

        map.fitBounds(route.getBounds());
    </script>
</body>
</html>
    `;
  };

  const currentRoute = pathData ? getCurrentRoute(pathData) : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Navigation size={24} color="#FF1493" />
          <Text style={styles.headerTitle}>Route Navigation</Text>
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
              editable={!loading && !isNavigating}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Destination Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., AIIMS, Delhi"
              value={destination}
              onChangeText={setDestination}
              editable={!loading && !isNavigating}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || isNavigating) && styles.buttonDisabled]}
            onPress={handleFindRoutes}
            disabled={loading || isNavigating}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Find Routes</Text>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorContainer}>
              <AlertCircle size={20} color="#FF1493" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Route Selection */}
          {pathData && (
            <View style={styles.routeSelectionContainer}>
              <Text style={styles.sectionTitle}>Select Route</Text>
              <View style={styles.routeButtons}>
                <TouchableOpacity
                  style={[
                    styles.routeButton,
                    selectedRoute === 'safest' && styles.routeButtonActive,
                  ]}
                  onPress={() => handleRouteChange('safest')}
                  disabled={isNavigating}
                >
                  <Text
                    style={[
                      styles.routeButtonText,
                      selectedRoute === 'safest' && styles.routeButtonTextActive,
                    ]}
                  >
                    Safest
                  </Text>
                  <Text style={styles.routeButtonDistance}>
                    {pathData.safest_distance_km?.toFixed(2)} km
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.routeButton,
                    selectedRoute === 'fastest' && styles.routeButtonActive,
                  ]}
                  onPress={() => handleRouteChange('fastest')}
                  disabled={isNavigating}
                >
                  <Text
                    style={[
                      styles.routeButtonText,
                      selectedRoute === 'fastest' && styles.routeButtonTextActive,
                    ]}
                  >
                    Fastest
                  </Text>
                  <Text style={styles.routeButtonDistance}>
                    {pathData.fastest_distance_km?.toFixed(2)} km
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.routeButton,
                    selectedRoute === 'unsafe' && styles.routeButtonActive,
                  ]}
                  onPress={() => handleRouteChange('unsafe')}
                  disabled={isNavigating}
                >
                  <Text
                    style={[
                      styles.routeButtonText,
                      selectedRoute === 'unsafe' && styles.routeButtonTextActive,
                    ]}
                  >
                    Unsafe
                  </Text>
                  <Text style={styles.routeButtonDistance}>
                    {pathData.unsafe_distance_km?.toFixed(2)} km
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Navigation Control */}
              <TouchableOpacity
                style={[
                  styles.navButton,
                  isNavigating && styles.navButtonStop,
                ]}
                onPress={isNavigating ? stopNavigation : startNavigation}
              >
                {isNavigating ? (
                  <>
                    <Square size={20} color="#fff" />
                    <Text style={styles.navButtonText}>Stop Navigation</Text>
                  </>
                ) : (
                  <>
                    <Play size={20} color="#fff" />
                    <Text style={styles.navButtonText}>Start Navigation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Progress Card */}
          {isNavigating && pathData && (
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Navigation Progress</Text>
              
              {isOffRoute && (
                <View style={styles.offRouteWarning}>
                  <AlertCircle size={20} color="#FF1493" />
                  <Text style={styles.offRouteText}>Off Route</Text>
                </View>
              )}

              <View style={styles.progressRow}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Distance Covered</Text>
                  <Text style={styles.progressValue}>
                    {distanceCovered.toFixed(2)} km
                  </Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Distance Remaining</Text>
                  <Text style={styles.progressValue}>
                    {distanceRemaining.toFixed(2)} km
                  </Text>
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${percentCompleted}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>
                {percentCompleted.toFixed(1)}% Completed
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Map View */}
        {pathData && (
          <View style={styles.mapContainer}>
            {useNativeMap && MapView && Platform.OS !== 'web' ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: pathData.source[0],
                  longitude: pathData.source[1],
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                showsUserLocation={isNavigating}
                followsUserLocation={isNavigating}
              >
                {/* Route Polyline */}
                {Polyline && (
                  <Polyline
                    coordinates={currentRoute.map(([lat, lon]) => ({
                      latitude: lat,
                      longitude: lon,
                    }))}
                    strokeColor={
                      selectedRoute === 'safest'
                        ? '#0066FF'
                        : selectedRoute === 'fastest'
                        ? '#00CC00'
                        : '#FF0000'
                    }
                    strokeWidth={5}
                  />
                )}

                {/* Source Marker */}
                {Marker && (
                  <Marker
                    coordinate={{
                      latitude: pathData.source[0],
                      longitude: pathData.source[1],
                    }}
                    title="Source"
                    pinColor="green"
                  />
                )}

                {/* Destination Marker */}
                {Marker && (
                  <Marker
                    coordinate={{
                      latitude: pathData.destination[0],
                      longitude: pathData.destination[1],
                    }}
                    title="Destination"
                    pinColor="red"
                  />
                )}
              </MapView>
            ) : (
              <WebView
                key={`map-${selectedRoute}-${userLocation?.[0]}-${userLocation?.[1]}`}
                source={{ html: generateMapHTML() }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            )}
          </View>
        )}

        {!pathData && !loading && (
          <View style={styles.placeholderContainer}>
            <Route size={64} color="#E2E8F0" />
            <Text style={styles.placeholderText}>
              Enter source and destination to find routes
            </Text>
            <Text style={styles.placeholderSubtext}>
              Select a route and start navigation for live tracking
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
    maxHeight: 400,
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  routeSelectionContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  routeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  routeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  routeButtonActive: {
    borderColor: '#FF1493',
    backgroundColor: '#FFF0F8',
  },
  routeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: 'Inter_600SemiBold',
  },
  routeButtonTextActive: {
    color: '#FF1493',
  },
  routeButtonDistance: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  navButton: {
    backgroundColor: '#FF1493',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonStop: {
    backgroundColor: '#DC2626',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  progressCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  offRouteWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  offRouteText: {
    color: '#DC2626',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  progressValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Inter_600SemiBold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF1493',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF1493',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  mapContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  map: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
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


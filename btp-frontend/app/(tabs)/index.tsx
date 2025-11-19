import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { Bell, Phone, MapPin, UserPlus } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Header from '../../components/header'; // Adjust if needed

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserName(user.displayName || user.email);
      } else {
        setUserName(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateContacts = () => {
    router.push('/update-contacts');
  };

  const handleSOSPress = () => {
    router.push('/emergency-sms');
  };

  const handleEmergencyContact = () => {
    router.push('/contacts');
  };

  const handleTrackMe = () => {
    router.push('/path');
  };

  return (
    <View style={styles.container}>
      {/* Floating Image - Positioned based on screen size */}
      <Image
        source={require('../../image/home.png')}
        style={[
          styles.cornerImage,
          {
            bottom: isSmallScreen ? 10 : 20,
            right: isSmallScreen ? -30 : 20,
            //right: isSmallScreen ? -40 : 20,
            width: isSmallScreen ? 400 : 500,
            height: isSmallScreen ? 400 : 500,
            opacity: isSmallScreen ? 0.25 : 0.6,
          },
        ]}
      />

      {/* Header */}
      <View style={styles.headerContainer}>
        <Header title={`Hi ${userName || 'there'}`} subtitle="You're Safe with" />
      </View>

      {/* Feature Buttons */}
      <View style={[styles.grid, !isSmallScreen && styles.gridWide]}>
        <FeatureCard
          icon={<Bell size={28} color="#FF69B4" />}
          bg="#FFB6C1"
          label="SOS"
          onPress={handleSOSPress}
        />
        <FeatureCard
          icon={<Phone size={28} color="#87CEEB" />}
          bg="#ADD8E6"
          label="Emergency Contacts"
          onPress={handleEmergencyContact}
        />
        <FeatureCard
          icon={<MapPin size={28} color="#32CD32" />}
          bg="#98FB98"
          label="Safe Path"
          onPress={handleTrackMe}
        />
        <FeatureCard
          icon={<UserPlus size={28} color="#DA70D6" />}
          bg="#DDA0DD"
          label="Update Contacts"
          onPress={handleUpdateContacts}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>SafeShe protects you everywhere 💌</Text>
      </View>
    </View>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  label: string;
  bg: string;
  onPress?: () => void;
}

function FeatureCard({ icon, label, bg, onPress }: FeatureCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress || (() => console.log(`${label} pressed`))}
      disabled={!onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.cardText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFCAD4',
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingHorizontal: 20,
    position: 'relative',
  },
  headerContainer: {
    zIndex: 2,
  },
  cornerImage: {
    position: 'absolute',
    resizeMode: 'cover',
    borderRadius: 300,
    zIndex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 18,
    marginTop: 30,
    zIndex: 2,
  },
  gridWide: {
    maxWidth: 1024,
    alignSelf: 'center',
  },
  card: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#f8bbd0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#e0e0e0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  cardText: {
    textAlign: 'center',
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '600',
    color: '#444',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: 20,
    zIndex: 2,
  },
  footerText: {
    fontSize: 12,
    color: '#777',
  },
});
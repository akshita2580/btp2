import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Type definitions
export interface Contact {
  name: string;
  phone: string;
  relation: string;
  _id?: string;
}

interface ContactsContextType {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  emergencyMessage: string;

  fetchContacts: (userId: string) => Promise<void>;
  addContact: (userId: string, contact: Omit<Contact, '_id'>) => Promise<void>;
  deleteContact: (userId: string, contactId: string) => Promise<void>;
  updateContact: (userId: string, contactId: string, contact: Omit<Contact, '_id'>) => Promise<void>;
  updateEmergencyMessage: (message: string) => void;
}

// ⚠️ IMPORTANT: Use your actual IPv4 address (check by running `ipconfig` on your PC)
const API_BASE_URL = 'http://172.22.60.96:5000/api';

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export const ContactsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyMessage, setEmergencyMessage] = useState<string>(
    'I need help! Please come to my location immediately.'
  );

  const updateEmergencyMessage = (message: string) => {
    setEmergencyMessage(message);
  };

  // ✅ Helper: get token once (avoid repeating)
  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
      headers: { Authorization: `Bearer ${token}` },
    };
  };

  const fetchContacts = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/contacts/${userId}`, config);

      setContacts(response.data || []);
    } catch (err: any) {
      setError('Failed to fetch contacts');
      console.error('Error fetching contacts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async (userId: string, contact: Omit<Contact, '_id'>) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthHeader();
      await axios.post(`${API_BASE_URL}/contacts/${userId}`, contact, config);

      await fetchContacts(userId);
    } catch (err: any) {
      setError('Failed to add contact');
      console.error('Error adding contact:', err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (userId: string, contactId: string) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthHeader();
      await axios.delete(`${API_BASE_URL}/contacts/${userId}/${contactId}`, config);

      await fetchContacts(userId);
    } catch (err: any) {
      setError('Failed to delete contact');
      console.error('Error deleting contact:', err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateContact = async (userId: string, contactId: string, contact: Omit<Contact, '_id'>) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthHeader();
      await axios.put(`${API_BASE_URL}/contacts/${userId}/${contactId}`, contact, config);

      await fetchContacts(userId);
    } catch (err: any) {
      setError('Failed to update contact');
      console.error('Error updating contact:', err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContactsContext.Provider
      value={{
        contacts,
        loading,
        error,
        emergencyMessage,
        fetchContacts,
        addContact,
        deleteContact,
        updateContact,
        updateEmergencyMessage,
      }}
    >
      {children}
    </ContactsContext.Provider>
  );
};

export const useContacts = () => {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
};

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import api from '../services/Client';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function NetworkDiagnosticsModal({ theme, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);
    
    const newResults = [];
    
    try {
      // Test 1: Current API URL
      newResults.push({
        name: 'Current API URL',
        result: api.getCurrentBaseURL(),
        success: true
      });
      
      // Test 2: Check HTTPS Certificate
      try {
        const certCheck = await api.checkCertificate();
        newResults.push({
          name: 'HTTPS Certificate',
          result: certCheck.message + (certCheck.error ? ` - ${certCheck.error}` : ''),
          success: certCheck.https
        });
      } catch (error) {
        newResults.push({
          name: 'HTTPS Certificate',
          result: `ERROR: ${error.message}`,
          success: false
        });
      }
      
      // Test 3: Connectivity
      try {
        await api.testConnectivity();
        newResults.push({
          name: 'API Connectivity Test',
          result: 'OK - Server is reachable',
          success: true
        });
      } catch (error) {
        newResults.push({
          name: 'API Connectivity Test',
          result: `FAILED: ${error.message}`,
          success: false
        });
      }
      
      // Test 4: Try switching to HTTP
      try {
        api.switchToHTTP();
        await api.testConnectivity();
        newResults.push({
          name: 'HTTP Fallback Test',
          result: 'OK - HTTP is working',
          success: true
        });
        api.switchToHTTPS(); // Switch back
      } catch (error) {
        newResults.push({
          name: 'HTTP Fallback Test',
          result: `FAILED: ${error.message}`,
          success: false
        });
        api.switchToHTTPS(); // Try to switch back anyway
      }
      
      // Test 5: Reset Connections
      try {
        api.resetConnections();
        newResults.push({
          name: 'Reset Connections',
          result: 'OK - HTTP/HTTPS sessions cleared',
          success: true
        });
      } catch (error) {
        newResults.push({
          name: 'Reset Connections',
          result: `Failed: ${error.message}`,
          success: false
        });
      }
      
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setResults(newResults);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Network Diagnostics</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={runDiagnostics}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Run Diagnostics</Text>
          )}
        </TouchableOpacity>

        {results.map((result, index) => (
          <View key={index} style={[styles.resultItem, { backgroundColor: result.success ? theme.inputBackground : '#ffe6e6' }]}>
            <Icon
              name={result.success ? 'check-circle' : 'error'}
              size={20}
              color={result.success ? '#4CAF50' : '#f44336'}
            />
            <View style={styles.resultText}>
              <Text style={[styles.resultName, { color: theme.text }]}>{result.name}</Text>
              <Text style={[styles.resultValue, { color: theme.textSecondary }]}>{result.result}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.infoBox, { backgroundColor: '#e3f2fd' }]}>
          <Icon name="info" size={20} color="#1976d2" />
          <Text style={[styles.infoText, { color: '#1976d2' }]}>
            Если HTTPS Certificate FAILED:
            {'\n'}• Сервер может иметь невалидный или истекший сертификат
            {'\n'}• Используйте HTTP вместо HTTPS
            {'\n'}• Обновите сертификат на сервере
          </Text>
        </View>

        <View style={[styles.infoBox, { backgroundColor: '#f3e5f5' }]}>
          <Icon name="tips-and-updates" size={20} color="#7b1fa2" />
          <Text style={[styles.infoText, { color: '#7b1fa2' }]}>
            После переустановки приложения или при проблемах:
            {'\n'}• Нажмите "Run Diagnostics"
            {'\n'}• Проверьте "Reset Connections" статус
            {'\n'}• Перезагрузитесь в приложении
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  resultText: {
    marginLeft: 12,
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 12,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});

import * as React from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Appbar, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColors';

export default function PrivacyScreen({ navigation }) {
  const { isDarkMode } = useTheme();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();

  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const surfaceColor = isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)';
  const dividerColor = isDarkMode ? '#2A2A2A' : '#E0E0E0';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Appbar.Header style={{ backgroundColor: bgColor }}>
        <Appbar.Action 
          icon="arrow-left" 
          color={textColor} 
          onPress={() => navigation.goBack()}
        />
        <Appbar.Content title="Privacy Policy" color={textColor} />
      </Appbar.Header>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(16, insets.bottom + 100) }]}
      >
        <View style={[styles.section, { backgroundColor: surfaceColor }]}>
          <Text style={[styles.title, { color: textColor }]}>Privacy Policy</Text>
          <Text style={[styles.date, { color: subTextColor }]}>Last updated: {new Date().toLocaleDateString()}</Text>
          
          <Divider style={{ backgroundColor: dividerColor, marginVertical: 16 }} />

          <Text style={[styles.heading, { color: textColor }]}>1. Information We Collect</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            We collect information that you provide directly to us, including:
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Name and username
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Email address
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Profile photos and content you post
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Location data (when you enable location services)
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Messages and communications with other users
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>2. How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            We use the information we collect to:
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Provide, maintain, and improve our services
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Process and complete transactions
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Send you technical notices and support messages
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Respond to your comments and questions
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Monitor and analyze trends and usage
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>3. Information Sharing</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            We do not sell your personal information. We may share your information:
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • With other users as part of the service (e.g., your profile, posts)
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • With service providers who assist us in operating our platform
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • When required by law or to protect our rights
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>4. Data Security</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>5. Your Rights</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            You have the right to:
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Access and update your personal information
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Delete your account and associated data
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Opt out of certain data collection
          </Text>
          <Text style={[styles.bullet, { color: subTextColor }]}>
            • Request a copy of your data
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>6. Children's Privacy</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            Our service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>7. Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            Our service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties.
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>8. Changes to This Policy</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.
          </Text>

          <Text style={[styles.heading, { color: textColor, marginTop: 24 }]}>9. Contact Us</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            If you have any questions about this Privacy Policy, please contact us through the Help section in the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 16,
    marginTop: 4,
  },
});


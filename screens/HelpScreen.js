import * as React from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Linking } from 'react-native';
import { Appbar, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColors';

export default function HelpScreen({ navigation }) {
  const { isDarkMode } = useTheme();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [expandedSection, setExpandedSection] = React.useState(null);

  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const surfaceColor = isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)';
  const dividerColor = isDarkMode ? '#2A2A2A' : '#E0E0E0';

  const faqSections = [
    {
      id: 'getting-started',
      question: 'How do I get started?',
      answer: 'Create an account using your email or sign in with Google/Apple. Once logged in, you can start posting, creating groups, and connecting with friends.',
    },
    {
      id: 'creating-posts',
      question: 'How do I create a post?',
      answer: 'Tap the "+" button on the Feed screen. You can add photos, videos, location, and text to your post. Once published, your post will appear in your feed and be visible to your friends.',
    },
    {
      id: 'groups',
      question: 'How do groups work?',
      answer: 'Groups allow you to organize events and activities with friends. Create a group, add friends, set a time range, and plan your activities together. You can chat, share photos, and coordinate within the group.',
    },
    {
      id: 'events',
      question: 'How do I create an event?',
      answer: 'Navigate to the Tonight screen and tap "Create Event". Fill in the event details including name, location, date/time, and privacy settings. You can also add a cover photo to make your event stand out.',
    },
    {
      id: 'friends',
      question: 'How do I add friends?',
      answer: 'Go to the Friends tab in your profile. You can search for users by username and send friend requests. Once accepted, you\'ll be able to see each other\'s posts and interact.',
    },
    {
      id: 'privacy',
      question: 'How do I control my privacy?',
      answer: 'You can adjust your privacy settings in your profile. Control who can see your posts, manage your friend requests, and block users if needed. Your location is only shared when you enable location services.',
    },
    {
      id: 'reporting',
      question: 'How do I report inappropriate content?',
      answer: 'If you see content that violates our community guidelines, you can report it by tapping the menu icon on the post or profile. Our team will review reports and take appropriate action.',
    },
    {
      id: 'account',
      question: 'How do I delete my account?',
      answer: 'Go to Settings in your profile, scroll down to "Delete Account", and follow the prompts. This will permanently delete your account and all associated data.',
    },
  ];

  const toggleSection = (id) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Appbar.Header style={{ backgroundColor: bgColor }}>
        <Appbar.Action 
          icon="arrow-left" 
          color={textColor} 
          onPress={() => navigation.goBack()}
        />
        <Appbar.Content title="Help & Support" color={textColor} />
      </Appbar.Header>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(16, insets.bottom + 100) }]}
      >
        <View style={[styles.section, { backgroundColor: surfaceColor }]}>
          <Text style={[styles.title, { color: textColor }]}>Need Help?</Text>
          <Text style={[styles.subtitle, { color: subTextColor }]}>
            We're here to help! Check out the frequently asked questions below or contact our support team.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: surfaceColor, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Frequently Asked Questions</Text>
          
          {faqSections.map((faq, index) => (
            <View key={faq.id}>
              <TouchableOpacity
                onPress={() => toggleSection(faq.id)}
                style={styles.faqItem}
              >
                <Text style={[styles.faqQuestion, { color: textColor }]}>
                  {faq.question}
                </Text>
                <Text style={[styles.expandIcon, { color: subTextColor }]}>
                  {expandedSection === faq.id ? '−' : '+'}
                </Text>
              </TouchableOpacity>
              
              {expandedSection === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={[styles.faqAnswerText, { color: subTextColor }]}>
                    {faq.answer}
                  </Text>
                </View>
              )}
              
              {index < faqSections.length - 1 && (
                <Divider style={{ backgroundColor: dividerColor, marginVertical: 8 }} />
              )}
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: surfaceColor, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Contact Support</Text>
          <Text style={[styles.paragraph, { color: subTextColor }]}>
            If you can't find the answer you're looking for, our support team is ready to help.
          </Text>
          
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: themeColors.primary }]}
            onPress={() => Linking.openURL('mailto:support@rollapp.com?subject=Support Request')}
          >
            <Text style={styles.contactButtonText}>Email Support</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: surfaceColor, marginTop: 16, marginBottom: 16 }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Links</Text>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('Privacy')}
            style={styles.linkItem}
          >
            <Text style={[styles.linkText, { color: themeColors.primary }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
          
          <Divider style={{ backgroundColor: dividerColor, marginVertical: 8 }} />
          
          <TouchableOpacity
            onPress={() => {
              // Terms of Service - you can create a separate screen for this if needed
              alert('Terms of Service\n\nBy using Roll, you agree to our Terms of Service. For detailed terms, please contact support.');
            }}
            style={styles.linkItem}
          >
            <Text style={[styles.linkText, { color: themeColors.primary }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  faqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 16,
  },
  expandIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  faqAnswer: {
    paddingLeft: 16,
    paddingBottom: 12,
  },
  faqAnswerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  contactButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkItem: {
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
  },
});


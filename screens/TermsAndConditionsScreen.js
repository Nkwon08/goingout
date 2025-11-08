// Terms and Conditions screen
import * as React from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text, Appbar } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';
import { useNavigation } from '@react-navigation/native';

const IU_CRIMSON = '#CC0000';

export default function TermsAndConditionsScreen() {
  const { background, text, subText } = useThemeColors();
  const navigation = useNavigation();

  const getCurrentDate = () => {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  };

  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Appbar.Header style={{ backgroundColor: 'transparent' }}>
        <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={text} />
        <Appbar.Content title="Terms of Use" color={text} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={[styles.sectionTitle, { color: text }]}>
          Terms of Use (Plain‑Language Draft)
        </Text>
        <Text style={[styles.lastUpdated, { color: subText }]}>
          Last updated: {getCurrentDate()}
        </Text>

        <Text style={[styles.introText, { color: text, marginTop: 16 }]}>
          We're a tiny team. This is a simple, no‑lawyer version so we can ship safely. Please read it—using the app means you agree to it.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          1) What this covers
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          These Terms apply to the Roll mobile app, site, and related services (the <Text style={{ fontWeight: '700' }}>Service</Text>) run by Jose Zapien Guerra, Nathan Kwon, and Sidney Robinson (<Text style={{ fontWeight: '700' }}>we/us</Text>).
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          2) Who can use it
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          • You must be <Text style={{ fontWeight: '700' }}>21+</Text>. If your local law requires a higher age for the content or features you access, you must meet that age. We may take steps to verify age and may suspend or terminate accounts we reasonably believe are underage.{'\n\n'}
          • Keep your account secure. You're responsible for anything done on your account.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          3) You own your posts, but you're responsible for them
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          • <Text style={{ fontWeight: '700' }}>You own your content.</Text>{'\n\n'}
          • <Text style={{ fontWeight: '700' }}>License to run the app.</Text> You give us a free, worldwide license to host, process, and show your content in the app (and back it up) until you delete it from our systems.{'\n\n'}
          • <Text style={{ fontWeight: '700' }}>Your promise.</Text> You have rights to what you post, and your posts don't break the law or other people's rights.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          4) We're not the publisher of user posts
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          • People—not us—create their own posts. We don't promise to review everything.{'\n\n'}
          • We may remove or hide content or suspend accounts if we think they break these rules or create risk. We're not liable for what other users post or do.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          5) Simple community rules
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          Don't post or do anything that involves:
        </Text>
        <Text style={[styles.bodyText, { color: text, marginTop: 8 }]}>
          • Illegal activity; threats; harassment; hate; sexual content involving minors; or encouraging self‑harm.{'\n\n'}
          • Sharing others' private information or images without consent (no doxxing or non‑consensual imagery).{'\n\n'}
          • Copyright/trademark infringement or impersonation.{'\n\n'}
          • Spam, scams, or malware; trying to break, scrape, or overload the Service.
        </Text>
        <Text style={[styles.bodyText, { color: text, marginTop: 8 }]}>
          Breaking the rules can lead to content removal or account suspension/ban. We may contact platforms or law enforcement if required by law or safety concerns.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          6) Copyright complaints (DMCA, U.S.)
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          If you think something on the Service infringes your copyright, email{' '}
          <TouchableOpacity onPress={() => handleEmailPress('rolltheapp@gmail.com')}>
            <Text style={[styles.linkText, { color: IU_CRIMSON }]}>rolltheapp@gmail.com</Text>
          </TouchableOpacity>
          {' '}with: (1) what work is infringed, (2) the content URL/username, (3) your contact info, and (4) a good‑faith statement that it's unauthorized. If your post was removed by mistake, you can send a counter‑notice. We may disable repeat infringers.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          7) Safety & advice
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          • Posts can be wrong or misleading. Use your judgment. The Service doesn't provide professional advice (medical, legal, financial, etc.).
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          8) Third‑party stuff
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          Links, app stores, and payment providers have their own terms and privacy rules. We're not responsible for them.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          9) Ending or changing the Service
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          We can change features or stop providing the Service at any time. You can stop using it whenever you want. We can suspend or end accounts that break these Terms or create risk for others.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          10) Privacy
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          See our <Text style={{ fontWeight: '700' }}>Privacy Policy</Text> for how we handle data.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          11) Disclaimers & limits
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          • The Service is provided <Text style={{ fontWeight: '700' }}>as‑is</Text> and <Text style={{ fontWeight: '700' }}>as available</Text> with no warranties.{'\n\n'}
          • To the extent the law allows, we're not liable for indirect or special damages. Our total liability for any claim is capped at <Text style={{ fontWeight: '700' }}>$100</Text> or the amount you paid us in the last 12 months—whichever is higher.
        </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
          12) Contact
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          Questions or reports:{' '}
          <TouchableOpacity onPress={() => handleEmailPress('rolltheapp@gmail.com')}>
            <Text style={[styles.linkText, { color: IU_CRIMSON }]}>rolltheapp@gmail.com</Text>
          </TouchableOpacity>
        </Text>

        <View style={styles.divider} />
        
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: text, marginTop: 16 }]}>
          Quick summary for users (not legally binding)
        </Text>
        <Text style={[styles.bodyText, { color: text }]}>
          • Be kind. Be legal. Respect privacy and IP.{'\n\n'}
          • You own your posts; we can show them in the app. Delete to remove.{'\n\n'}
          • Report bad stuff to{' '}
          <TouchableOpacity onPress={() => handleEmailPress('rolltheapp@gmail.com')}>
            <Text style={[styles.linkText, { color: IU_CRIMSON }]}>rolltheapp@gmail.com</Text>
          </TouchableOpacity>
          . For emergencies, contact local authorities.
        </Text>

        <View style={{ height: 40 }} />
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
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  lastUpdated: {
    fontSize: 12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 24,
  },
});


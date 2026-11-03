import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes, borderRadius } from '../constants/theme';

interface AiInputProps {
  onSubmitPrompt: (text: string) => Promise<void>;
  isProcessing: boolean;
}

export const AiInput: React.FC<AiInputProps> = ({ onSubmitPrompt, isProcessing }) => {
  const [prompt, setPrompt] = useState<string>('');

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isProcessing) return;
    await onSubmitPrompt(trimmed);
    setPrompt('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={16} color={colors.primary} />
        <Text style={styles.hintText}>
          💬 &quot;I&apos;m going to Bangalore, wake me 30 min before&quot;
        </Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Tell Alarmy where you're travelling..."
          placeholderTextColor={colors.textMuted}
          value={prompt}
          onChangeText={setPrompt}
          editable={!isProcessing}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!prompt.trim() || isProcessing) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!prompt.trim() || isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Text style={styles.sendText}>Send</Text>
              <Ionicons name="send" size={14} color={colors.text} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
});

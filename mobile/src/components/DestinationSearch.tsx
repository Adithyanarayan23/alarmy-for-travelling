import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Destination } from '../types';
import { searchDestinations } from '../services/destinationService';
import { colors, spacing, fontSizes, borderRadius } from '../constants/theme';

interface DestinationSearchProps {
  selectedDestination: Destination | null;
  onSelectDestination: (destination: Destination | null) => void;
}

export const DestinationSearch: React.FC<DestinationSearchProps> = ({
  selectedDestination,
  onSelectDestination,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<Destination[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const performSearch = useCallback(async (searchText: string) => {
    if (searchText.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const items = await searchDestinations(searchText);
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelect = (item: Destination) => {
    onSelectDestination(item);
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Where are you going?</Text>

      <View style={styles.inputContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Search destination (e.g. Bangalore, Mumbai)..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {isSearching && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        )}
        {query.length > 0 && !isSearching && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setResults([]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsContainer}>
          {results.map((item, idx) => (
            <TouchableOpacity
              key={item.id ?? `${item.name}-${idx}`}
              style={[
                styles.resultRow,
                idx === results.length - 1 && styles.resultRowLast,
              ]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <View style={styles.resultTextWrap}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {item.displayName}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedDestination && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View style={styles.selectedTitleRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={styles.selectedLabel}>
                Selected: <Text style={styles.selectedName}>{selectedDestination.name}</Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onSelectDestination(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedAddress} numberOfLines={2}>
            {selectedDestination.displayName}
          </Text>
          <Text style={styles.selectedHint}>
            ETA will be calculated automatically from your live GPS location
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 52,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
  },
  loader: {
    marginLeft: spacing.sm,
  },
  resultsContainer: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultTextWrap: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  resultName: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  resultSub: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  selectedCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectedLabel: {
    color: colors.text,
    fontSize: fontSizes.md,
  },
  selectedName: {
    fontWeight: '700',
    color: colors.text,
  },
  selectedAddress: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  selectedHint: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type LegendItem = {
  label: string;
  color: string;
};

type LegendProps = {
  items: LegendItem[];
};

const Legend = ({ items }: LegendProps) => {
  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View key={`${item.label}-${item.color}`} style={styles.item}>
          <View style={[styles.line, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    flexWrap: 'wrap',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 4,
  },
  line: {
    width: 20,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    color: '#000',
  },
});

export default Legend;

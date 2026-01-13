import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Legend = () => {
  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <View style={[styles.line, { backgroundColor: 'lime' }]} />
        <Text style={styles.label}>Green Channel</Text>
      </View>

      <View style={styles.item}>
        <View style={[styles.line, { backgroundColor: 'red' }]} />
        <Text style={styles.label}>Red Channel</Text>
      </View>

      <View style={styles.item}>
        <View style={[styles.line, { backgroundColor: 'black' }]} />
        <Text style={styles.label}>IR Channel</Text>
      </View>
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

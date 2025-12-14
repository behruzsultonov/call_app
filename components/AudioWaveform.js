import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Simple seeded random number generator
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const BAR_WIDTH = 3;
const BAR_GAP = 2;

const AudioWaveform = ({ 
  isPlaying = false, 
  duration = 0, 
  currentTime = 0,
  waveformBars = 25,
  color = '#4FC3F7',
  backgroundColor = '#B0BEC5',
  seed = Date.now()
}) => {
  // Generate seeded random heights for waveform bars
  const generateWaveformHeights = () => {
    const heights = [];
    for (let i = 0; i < waveformBars; i++) {
      // Use a combination of seed and index for better distribution
      const randomSeed = (seed * (i + 1) + i * 1000) % 2147483647;
      heights.push(seededRandom(randomSeed) * 20 + 5); // Heights between 5 and 25
    }
    return heights;
  };

  const waveformHeights = generateWaveformHeights();
  
  // Calculate waveform width
  const waveformWidth = waveformBars * (BAR_WIDTH + BAR_GAP);

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  // Calculate which bars should be colored based on progress
  const coloredBarsCount = duration > 0 ? Math.floor((progressPercentage / 100) * waveformBars) : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.waveformContainer, { width: waveformWidth }]}>
        {waveformHeights.map((height, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: height,
                backgroundColor: index < coloredBarsCount ? color : backgroundColor,
                opacity: index < coloredBarsCount ? 1 : 0.5
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingLeft: 4,
    paddingRight: 4,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2,
    marginHorizontal: BAR_GAP / 2,
    minHeight: 5,
  },
});
export default AudioWaveform;
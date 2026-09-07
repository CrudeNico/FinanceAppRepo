import { StyleSheet, Text } from "react-native";

export function ChartAxis({
  ticks,
  yFor,
  color,
}: {
  ticks: number[];
  yFor: (value: number) => number;
  color: string;
}) {
  return ticks.map((tick) => (
    <Text
      key={tick}
      pointerEvents="none"
      style={[styles.label, { top: yFor(tick) - 7, color }]}
    >
      {tick.toFixed(2)}
    </Text>
  ));
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    right: 0,
    width: 58,
    textAlign: "right",
    fontSize: 10,
    fontStyle: "normal",
    fontWeight: "400",
  },
});

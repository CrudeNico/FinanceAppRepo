import { Text, type StyleProp, type TextStyle } from "react-native";

export function MoneyAmount({
  value,
  color,
  style,
  euroStyle,
}: {
  value: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  euroStyle?: StyleProp<TextStyle>;
}) {
  const text = Math.abs(value).toFixed(2);
  return (
    <Text style={[style, color ? { color } : null]}>
      {value < 0 ? "−" : null}
      <Text style={euroStyle}>€</Text>
      {text.slice(0, -3)}
      <Text style={euroStyle}>{text.slice(-3)}</Text>
    </Text>
  );
}

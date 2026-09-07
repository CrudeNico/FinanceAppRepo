import { Rect, Text as SvgText } from "react-native-svg";
import { svgUiFont } from "./svgFont";

export function ChartPill({
  x,
  y,
  label,
  fill,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
}) {
  return (
    <>
      <Rect x={x} y={y} width={50} height={20} rx={10} fill={fill} />
      <SvgText
        x={x + 25}
        y={y + 14}
        fill="#ffffff"
        fontSize="10"
        fontWeight="600"
        fontFamily={svgUiFont}
        fontStyle="normal"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </>
  );
}
